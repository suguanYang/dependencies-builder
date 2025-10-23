import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./database/prisma";

// Create access control for admin plugin
import { createAccessControl } from "better-auth/plugins/access";
import { error, info } from "./logging";

const statement = {
  // Define resources and actions for our application
  project: ["create", "read", "update", "delete"],
  node: ["create", "read", "update", "delete"],
  connection: ["create", "read", "update", "delete"],
  action: ["create", "read", "update", "delete", "stop"],
  database: ["admin", "query", "schema"],
} as const;

const ac = createAccessControl(statement);

// Define roles with specific permissions
export const userRole = ac.newRole({
  project: ["read"],
  node: ["read"],
  connection: ["read"],
  action: ["read"],
  database: [], // Users don't have database permissions
});

export const adminRole = ac.newRole({
  project: ["create", "read", "update", "delete"],
  node: ["create", "read", "update", "delete"],
  connection: ["create", "read", "update", "delete"],
  action: ["create", "read", "update", "delete", "stop"],
  database: ["admin", "query", "schema"],
});

export const auth = betterAuth({
  appName: 'dms',
  basePath: 'auth',
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-change-in-production",
  trustedOrigins: process.env.CLIENT_DOMAIN ? [process.env.CLIENT_DOMAIN] : [
    "http://localhost:3000",
    "http://localhost:3001",
    // Add production domains here
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false, // Don't allow users to set their own role
      },
    },
  },
  plugins: [
    admin({
      ac,
      roles: {
        user: userRole,
        admin: adminRole,
      },
      defaultRole: "user",
      adminRoles: ["admin"],
      // Optional: Add specific user IDs that should always be admins
      // adminUserIds: ["user-id-1", "user-id-2"],
    }),
  ],
  advanced: {
    useSecureCookies: false,
    // defaultCookieAttributes: {
    //   sameSite: 'None'
    // }
  },
  logger: {
    level: 'warn',
    log(level, message) {
      if (level === 'warn') {
        info(message)
      }

      if (level === 'error') {
        error(message)
      }
    },
  }
});

// Export types for client-side usage
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;