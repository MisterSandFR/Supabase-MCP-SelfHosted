import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BackupDatabaseInputSchema = z.object({
  format: z.enum(['sql', 'custom', 'tar']).optional().default('sql').describe("Backup format"),
  tables: z.array(z.string()).optional().describe("Specific tables to backup (all if not specified)"),
  schemaOnly: z.boolean().optional().default(false).describe("Backup schema only, no data"),
  dataOnly: z.boolean().optional().default(false).describe("Backup data only, no schema"),
  outputPath: z.string().optional().describe("Custom output path for backup file"),
  compress: z.boolean().optional().default(true).describe("Compress the backup"),
  uploadToStorage: z.boolean().optional().default(false).describe("Upload backup to Supabase storage")
});

const BackupDatabaseOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string()
  }))
});

type BackupDatabaseInput = z.infer<typeof BackupDatabaseInputSchema>;

export const backupDatabaseTool: Tool = {
  name: "backup_database",
  description: "Create a backup of the PostgreSQL database with various options",
  inputSchema: BackupDatabaseInputSchema,
  mcpInputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["sql", "custom", "tar"],
        description: "Backup format (default: sql)"
      },
      tables: {
        type: "array",
        items: { type: "string" },
        description: "Specific tables to backup"
      },
      schemaOnly: {
        type: "boolean",
        description: "Backup schema only, no data"
      },
      dataOnly: {
        type: "boolean",
        description: "Backup data only, no schema"
      },
      outputPath: {
        type: "string",
        description: "Custom output path for backup file"
      },
      compress: {
        type: "boolean",
        description: "Compress the backup"
      },
      uploadToStorage: {
        type: "boolean",
        description: "Upload backup to Supabase storage"
      }
    }
  },
  outputSchema: BackupDatabaseOutputSchema,
  execute: async (input: unknown, context: ToolContext) => {
    const validatedInput = BackupDatabaseInputSchema.parse(input || {});
    
    if (!context.config.dbUrl && !context.pg) {
      throw new Error("Database connection required for backup. Please provide DATABASE_URL.");
    }
    
    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = validatedInput.compress ? `.${validatedInput.format}.gz` : `.${validatedInput.format}`;
    const filename = `backup_${timestamp}${extension}`;
    
    // Determine output path
    const backupDir = validatedInput.outputPath || path.join(context.config.workspacePath, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, filename);
    
    // If using direct database URL, use pg_dump
    if (context.config.dbUrl) {
      try {
        // Build pg_dump command
        let pgDumpCmd = `pg_dump "${context.config.dbUrl}"`;
        
        // Add format option
        if (validatedInput.format !== 'sql') {
          pgDumpCmd += ` --format=${validatedInput.format}`;
        }
        
        // Add schema/data options
        if (validatedInput.schemaOnly) {
          pgDumpCmd += ' --schema-only';
        } else if (validatedInput.dataOnly) {
          pgDumpCmd += ' --data-only';
        }
        
        // Add table filters
        if (validatedInput.tables && validatedInput.tables.length > 0) {
          for (const table of validatedInput.tables) {
            pgDumpCmd += ` --table="${table}"`;
          }
        }
        
        // Add compression
        if (validatedInput.compress) {
          pgDumpCmd += ' | gzip';
        }
        
        pgDumpCmd += ` > "${backupPath}"`;
        
        // Execute backup
        await execAsync(pgDumpCmd);
        
        // Get file size
        const stats = await fs.stat(backupPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        // Upload to storage if requested
        let storageUrl = null;
        if (validatedInput.uploadToStorage && context.supabase) {
          try {
            // Create backups bucket if it doesn't exist
            const { data: buckets } = await context.supabase.storage.listBuckets();
            if (!buckets?.find(b => b.name === 'backups')) {
              await context.supabase.storage.createBucket('backups', { public: false });
            }
            
            // Upload file
            const fileContent = await fs.readFile(backupPath);
            const { data, error } = await context.supabase.storage
              .from('backups')
              .upload(filename, fileContent, {
                contentType: 'application/octet-stream'
              });
            
            if (error) throw error;
            storageUrl = data.path;
          } catch (error) {
            console.error('Failed to upload to storage:', error);
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              filename,
              path: backupPath,
              sizeInMB,
              format: validatedInput.format,
              compressed: validatedInput.compress,
              storageUrl,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // Fallback: Use SQL COPY commands for basic backup
      try {
        let backupContent = '';
        
        if (!validatedInput.dataOnly) {
          // Get schema DDL
          const schemaResult = await executeSqlWithFallback(`
            SELECT 
              'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' ||
              array_to_string(array_agg(
                column_name || ' ' || data_type || 
                CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
              ), ', ') || ');' as ddl
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ${validatedInput.tables ? `AND table_name = ANY($1)` : ''}
            GROUP BY schemaname, tablename
          `, context, validatedInput.tables);
          
          backupContent += schemaResult.data.map((r: any) => r.ddl).join('\n\n');
        }
        
        if (!validatedInput.schemaOnly) {
          // Get table data
          const tablesResult = await executeSqlWithFallback(`
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ${validatedInput.tables ? `AND tablename = ANY($1)` : ''}
          `, context, validatedInput.tables);
          
          for (const table of tablesResult.data) {
            const dataResult = await executeSqlWithFallback(
              `SELECT * FROM ${table.schemaname}.${table.tablename}`,
              context
            );
            
            if (dataResult.data && dataResult.data.length > 0) {
              backupContent += `\n\n-- Data for ${table.schemaname}.${table.tablename}\n`;
              backupContent += `COPY ${table.schemaname}.${table.tablename} FROM stdin;\n`;
              backupContent += dataResult.data.map((row: any) => 
                Object.values(row).join('\t')
              ).join('\n');
              backupContent += '\n\\.\n';
            }
          }
        }
        
        // Write backup file
        if (validatedInput.compress) {
          const { gzip } = await import('zlib');
          const compressed = await promisify(gzip)(Buffer.from(backupContent));
          await fs.writeFile(backupPath, compressed);
        } else {
          await fs.writeFile(backupPath, backupContent);
        }
        
        const stats = await fs.stat(backupPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              filename,
              path: backupPath,
              sizeInMB,
              format: 'sql',
              compressed: validatedInput.compress,
              method: 'sql_copy',
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      } catch (error) {
        throw new Error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
};