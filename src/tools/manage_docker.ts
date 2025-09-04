import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ManageDockerInputSchema = z.object({
  action: z.enum(['status', 'logs', 'restart', 'stop', 'start', 'stats']).describe("Action to perform"),
  service: z.string().optional().describe("Specific service name (e.g., postgres, auth, storage)"),
  tail: z.number().optional().default(100).describe("Number of log lines to show (for logs action)"),
  follow: z.boolean().optional().default(false).describe("Follow log output (for logs action)"),
  composePath: z.string().optional().describe("Path to docker-compose file")
});

const ManageDockerOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal("text"),
    text: z.string()
  }))
});

type ManageDockerInput = z.infer<typeof ManageDockerInputSchema>;

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string[];
  created: string;
}

export const manageDockerTool: Tool = {
  name: "manage_docker",
  description: "Manage Docker containers for self-hosted Supabase (status, logs, restart)",
  inputSchema: ManageDockerInputSchema,
  mcpInputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["status", "logs", "restart", "stop", "start", "stats"],
        description: "Action to perform"
      },
      service: {
        type: "string",
        description: "Specific service name (e.g., postgres, auth, storage)"
      },
      tail: {
        type: "number",
        description: "Number of log lines to show (for logs action)"
      },
      follow: {
        type: "boolean",
        description: "Follow log output (for logs action)"
      },
      composePath: {
        type: "string",
        description: "Path to docker-compose file"
      }
    },
    required: ["action"]
  },
  outputSchema: ManageDockerOutputSchema,
  execute: async (input: unknown, context: ToolContext) => {
    const validatedInput = ManageDockerInputSchema.parse(input);
    
    try {
      switch (validatedInput.action) {
        case 'status': {
          // Get container status
          const { stdout } = await execAsync('docker ps --format "json"');
          const containers: DockerContainer[] = stdout
            .trim()
            .split('\n')
            .filter(line => line)
            .map(line => {
              try {
                const data = JSON.parse(line);
                return {
                  id: data.ID,
                  name: data.Names,
                  image: data.Image,
                  status: data.Status,
                  ports: data.Ports ? data.Ports.split(',') : [],
                  created: data.CreatedAt
                };
              } catch {
                return null;
              }
            })
            .filter((c): c is DockerContainer => c !== null);
          
          // Filter Supabase-related containers
          const supabaseContainers = containers.filter(c => 
            c.name.includes('supabase') || 
            c.name.includes('postgres') ||
            c.name.includes('kong') ||
            c.name.includes('gotrue') ||
            c.name.includes('realtime') ||
            c.name.includes('storage') ||
            c.name.includes('imgproxy') ||
            c.name.includes('vector')
          );
          
          // If service specified, filter further
          const filteredContainers = validatedInput.service 
            ? supabaseContainers.filter(c => c.name.includes(validatedInput.service))
            : supabaseContainers;
          
          // Check health status for each container
          const containerHealth = await Promise.all(
            filteredContainers.map(async (container) => {
              try {
                const { stdout: healthOutput } = await execAsync(
                  `docker inspect ${container.id} --format='{{json .State.Health}}'`
                );
                const health = healthOutput.trim() === 'null' ? null : JSON.parse(healthOutput);
                return {
                  ...container,
                  health: health?.Status || 'no health check'
                };
              } catch {
                return {
                  ...container,
                  health: 'unknown'
                };
              }
            })
          );
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                containers: containerHealth,
                summary: {
                  total: containerHealth.length,
                  running: containerHealth.filter(c => c.status.includes('Up')).length,
                  stopped: containerHealth.filter(c => !c.status.includes('Up')).length,
                  healthy: containerHealth.filter(c => c.health === 'healthy').length,
                  unhealthy: containerHealth.filter(c => c.health === 'unhealthy').length
                }
              }, null, 2)
            }]
          };
        }
        
        case 'logs': {
          if (!validatedInput.service) {
            throw new Error("Service name required for logs action");
          }
          
          // Find container
          const { stdout: psOutput } = await execAsync('docker ps --format "{{.Names}}"');
          const containerName = psOutput
            .split('\n')
            .find(name => name.includes(validatedInput.service));
          
          if (!containerName) {
            throw new Error(`No container found for service: ${validatedInput.service}`);
          }
          
          // Get logs
          let logCmd = `docker logs ${containerName}`;
          if (validatedInput.tail) {
            logCmd += ` --tail ${validatedInput.tail}`;
          }
          if (validatedInput.follow) {
            logCmd += ' --follow';
          }
          
          const { stdout, stderr } = await execAsync(logCmd);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                service: validatedInput.service,
                container: containerName,
                logs: stdout || stderr,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          };
        }
        
        case 'restart':
        case 'stop':
        case 'start': {
          if (!validatedInput.service) {
            throw new Error(`Service name required for ${validatedInput.action} action`);
          }
          
          // Find container
          const { stdout: psOutput } = await execAsync('docker ps -a --format "{{.Names}}"');
          const containerName = psOutput
            .split('\n')
            .find(name => name.includes(validatedInput.service));
          
          if (!containerName) {
            throw new Error(`No container found for service: ${validatedInput.service}`);
          }
          
          // Execute action
          await execAsync(`docker ${validatedInput.action} ${containerName}`);
          
          // Get new status
          const { stdout: statusOutput } = await execAsync(
            `docker ps -a --filter "name=${containerName}" --format "{{.Status}}"`
          );
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                action: validatedInput.action,
                service: validatedInput.service,
                container: containerName,
                status: statusOutput.trim(),
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          };
        }
        
        case 'stats': {
          // Get resource usage stats
          const { stdout } = await execAsync(
            'docker stats --no-stream --format "json"'
          );
          
          const stats = stdout
            .trim()
            .split('\n')
            .filter(line => line)
            .map(line => {
              try {
                const data = JSON.parse(line);
                return {
                  name: data.Name,
                  cpu: data.CPUPerc,
                  memory: data.MemUsage,
                  memoryPercent: data.MemPerc,
                  netIO: data.NetIO,
                  blockIO: data.BlockIO
                };
              } catch {
                return null;
              }
            })
            .filter(s => s !== null);
          
          // Filter Supabase-related containers
          const supabaseStats = stats.filter((s: any) => 
            s.name.includes('supabase') || 
            s.name.includes('postgres') ||
            s.name.includes('kong') ||
            s.name.includes('gotrue') ||
            s.name.includes('realtime') ||
            s.name.includes('storage')
          );
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                stats: validatedInput.service 
                  ? supabaseStats.filter((s: any) => s.name.includes(validatedInput.service))
                  : supabaseStats,
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          };
        }
        
        default:
          throw new Error(`Unknown action: ${validatedInput.action}`);
      }
    } catch (error) {
      // Check if Docker is available
      if (error instanceof Error && error.message.includes('docker')) {
        throw new Error("Docker command failed. Ensure Docker is installed and running.");
      }
      throw error;
    }
  }
};