import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";
import * as fs from 'fs/promises';
import * as path from 'path';

const ValidateMigrationInputSchema = z.object({
  migrationPath: z.string().describe("Path to the migration SQL file"),
  checkDependencies: z.boolean().optional().default(true).describe("Check for dependency issues"),
  checkConflicts: z.boolean().optional().default(true).describe("Check for potential conflicts"),
  dryRun: z.boolean().optional().default(false).describe("Execute migration in a transaction and rollback")
});

type ValidateMigrationInput = z.infer<typeof ValidateMigrationInputSchema>;

interface ValidationResult {
  status: 'safe' | 'warning' | 'error';
  message: string;
  details?: any;
}

export const validateMigrationTool: Tool = {
  name: "validate_migration",
  description: "Validate a migration file before applying it to check for potential issues",
  inputSchema: {
    type: "object",
    properties: {
      migrationPath: {
        type: "string",
        description: "Path to the migration SQL file"
      },
      checkDependencies: {
        type: "boolean",
        description: "Check for dependency issues"
      },
      checkConflicts: {
        type: "boolean",
        description: "Check for potential conflicts"
      },
      dryRun: {
        type: "boolean",
        description: "Execute migration in a transaction and rollback"
      }
    },
    required: ["migrationPath"]
  },
  execute: async (input: unknown, context: ToolContext) => {
    const validatedInput = ValidateMigrationInputSchema.parse(input);
    const results: ValidationResult[] = [];
    
    // Read migration file
    const migrationFile = path.isAbsolute(validatedInput.migrationPath) 
      ? validatedInput.migrationPath
      : path.join(context.workspacePath || process.cwd(), validatedInput.migrationPath);
    
    let migrationContent: string;
    try {
      migrationContent = await fs.readFile(migrationFile, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read migration file: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Parse SQL statements
    const statements = migrationContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    // Basic syntax validation
    const dangerousPatterns = [
      { pattern: /DROP\s+DATABASE/i, message: "DROP DATABASE detected - extremely dangerous" },
      { pattern: /DROP\s+SCHEMA\s+(public|auth|storage)/i, message: "Dropping system schema detected" },
      { pattern: /TRUNCATE\s+.*CASCADE/i, message: "TRUNCATE CASCADE detected - may affect multiple tables" },
      { pattern: /DELETE\s+FROM\s+\w+\s*;/i, message: "DELETE without WHERE clause detected" },
      { pattern: /UPDATE\s+\w+\s+SET\s+.*\s*;/i, message: "UPDATE without WHERE clause detected" }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(migrationContent)) {
        results.push({
          status: 'error',
          message,
          details: { pattern: pattern.toString() }
        });
      }
    }
    
    // Check for table modifications
    const alterTableMatches = migrationContent.match(/ALTER\s+TABLE\s+(\w+\.)?(\w+)/gi) || [];
    const dropColumnMatches = migrationContent.match(/DROP\s+COLUMN/gi) || [];
    const dropTableMatches = migrationContent.match(/DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(\w+\.)?(\w+)/gi) || [];
    
    if (dropColumnMatches.length > 0) {
      results.push({
        status: 'warning',
        message: `${dropColumnMatches.length} DROP COLUMN operation(s) detected`,
        details: { operations: dropColumnMatches }
      });
    }
    
    if (dropTableMatches.length > 0) {
      results.push({
        status: 'warning',
        message: `${dropTableMatches.length} DROP TABLE operation(s) detected`,
        details: { operations: dropTableMatches }
      });
    }
    
    // Check dependencies
    if (validatedInput.checkDependencies) {
      // Extract referenced tables
      const referencedTables = new Set<string>();
      const tablePattern = /(?:FROM|JOIN|UPDATE|INSERT\s+INTO|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE)\s+(\w+\.)?(\w+)/gi;
      let match;
      while ((match = tablePattern.exec(migrationContent)) !== null) {
        const schema = match[1]?.replace('.', '') || 'public';
        const table = match[2];
        referencedTables.add(`${schema}.${table}`);
      }
      
      // Check if referenced tables exist
      if (referencedTables.size > 0) {
        try {
          const tableCheckResult = await executeSqlWithFallback(`
            SELECT 
              schemaname || '.' || tablename as full_name
            FROM pg_tables
            WHERE schemaname || '.' || tablename = ANY($1::text[])
          `, context, [Array.from(referencedTables)]);
          
          const existingTables = new Set(tableCheckResult.data.map((r: any) => r.full_name));
          const missingTables = Array.from(referencedTables).filter(t => !existingTables.has(t));
          
          if (missingTables.length > 0) {
            results.push({
              status: 'warning',
              message: `Referenced table(s) not found: ${missingTables.join(', ')}`,
              details: { missingTables }
            });
          }
        } catch (error) {
          results.push({
            status: 'warning',
            message: 'Could not verify table dependencies',
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      }
      
      // Check for foreign key dependencies
      const fkPattern = /REFERENCES\s+(\w+\.)?(\w+)/gi;
      const foreignKeys = [];
      while ((match = fkPattern.exec(migrationContent)) !== null) {
        foreignKeys.push({
          schema: match[1]?.replace('.', '') || 'public',
          table: match[2]
        });
      }
      
      if (foreignKeys.length > 0) {
        results.push({
          status: 'warning',
          message: `${foreignKeys.length} foreign key reference(s) found`,
          details: { foreignKeys }
        });
      }
    }
    
    // Check for conflicts
    if (validatedInput.checkConflicts) {
      // Check for concurrent index creation
      if (/CREATE\s+INDEX\s+(?!CONCURRENTLY)/i.test(migrationContent)) {
        results.push({
          status: 'warning',
          message: 'Non-concurrent index creation detected - may lock table',
          details: { suggestion: 'Consider using CREATE INDEX CONCURRENTLY' }
        });
      }
      
      // Check for lock-heavy operations
      const lockOperations = [
        { pattern: /ALTER\s+TABLE\s+.*\s+ADD\s+COLUMN\s+.*\s+NOT\s+NULL(?!\s+DEFAULT)/i, message: 'Adding NOT NULL column without DEFAULT' },
        { pattern: /ALTER\s+TABLE\s+.*\s+ALTER\s+COLUMN\s+.*\s+TYPE/i, message: 'Changing column type' },
        { pattern: /REINDEX/i, message: 'REINDEX operation' },
        { pattern: /VACUUM\s+FULL/i, message: 'VACUUM FULL operation' }
      ];
      
      for (const { pattern, message } of lockOperations) {
        if (pattern.test(migrationContent)) {
          results.push({
            status: 'warning',
            message: `Lock-heavy operation detected: ${message}`,
            details: { pattern: pattern.toString() }
          });
        }
      }
    }
    
    // Dry run if requested
    if (validatedInput.dryRun) {
      try {
        // Begin transaction
        await executeSqlWithFallback("BEGIN", context);
        
        let executionErrors = [];
        for (const statement of statements) {
          try {
            await executeSqlWithFallback(statement, context);
          } catch (error) {
            executionErrors.push({
              statement: statement.substring(0, 100),
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        // Always rollback
        await executeSqlWithFallback("ROLLBACK", context);
        
        if (executionErrors.length > 0) {
          results.push({
            status: 'error',
            message: `Dry run failed with ${executionErrors.length} error(s)`,
            details: { errors: executionErrors }
          });
        } else {
          results.push({
            status: 'safe',
            message: 'Dry run completed successfully',
            details: { statementsExecuted: statements.length }
          });
        }
      } catch (error) {
        try {
          await executeSqlWithFallback("ROLLBACK", context);
        } catch {}
        
        results.push({
          status: 'error',
          message: 'Dry run failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        });
      }
    }
    
    // Analyze migration size and complexity
    const migrationStats = {
      totalStatements: statements.length,
      totalLines: migrationContent.split('\n').length,
      sizeInBytes: Buffer.byteLength(migrationContent),
      hasTransaction: /BEGIN|START\s+TRANSACTION/i.test(migrationContent),
      hasRollback: /ROLLBACK/i.test(migrationContent),
      ddlStatements: (migrationContent.match(/CREATE|ALTER|DROP/gi) || []).length,
      dmlStatements: (migrationContent.match(/INSERT|UPDATE|DELETE/gi) || []).length
    };
    
    if (migrationStats.totalStatements > 100) {
      results.push({
        status: 'warning',
        message: 'Large migration detected (>100 statements)',
        details: migrationStats
      });
    }
    
    if (!migrationStats.hasTransaction && migrationStats.totalStatements > 1) {
      results.push({
        status: 'warning',
        message: 'Migration has multiple statements but no explicit transaction',
        details: { suggestion: 'Consider wrapping in BEGIN/COMMIT' }
      });
    }
    
    // Generate overall assessment
    const errorCount = results.filter(r => r.status === 'error').length;
    const warningCount = results.filter(r => r.status === 'warning').length;
    const safeCount = results.filter(r => r.status === 'safe').length;
    
    const overallStatus = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'safe';
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          migrationFile: path.basename(migrationFile),
          overallStatus,
          summary: {
            errors: errorCount,
            warnings: warningCount,
            safe: safeCount
          },
          stats: migrationStats,
          validations: results,
          recommendation: overallStatus === 'error' 
            ? 'Migration has critical issues - DO NOT APPLY'
            : overallStatus === 'warning'
            ? 'Migration has warnings - review carefully before applying'
            : 'Migration appears safe to apply'
        }, null, 2)
      }]
    };
  }
};