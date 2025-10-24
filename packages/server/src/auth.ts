import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, apiKey } from "better-auth/plugins";
import { prisma } from "./database/prisma";

// Create access control for admin plugin
import { createAccessControl } from "better-auth/plugins/access";
import { error, info } from "./logging";
import { ADMIN_USER_EMAIL } from "./env";

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
  project: ["create", "read", "update", "delete"],
  node: ["create", "read", "update", "delete"],
  connection: ["create", "read", "update", "delete"],
  action: ["create", "read", "update", "delete", "stop"],
  database: [],
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
    cookieCache: {
      enabled: true,
      maxAge: 30 * 60 // Cache duration in seconds
    }
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
    apiKey({
      keyExpiration: {
        defaultExpiresIn: 30 * 60 * 1000
      }
    })
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

export const getAdminUserKey = async (keyName: string) => {
  const adminUser = await prisma.user.findUnique({
    where: {
      email: ADMIN_USER_EMAIL
    },
    select: {
      id: true
    }
  })
  if (!adminUser) {
    throw new Error('can not run cli without admin user')
  }


  return auth.api.createApiKey({
    body: {
      name: keyName,
      userId: adminUser.id,
      permissions: {
        node: ["create", "read", "update", "delete"]
      }
    }
  });
}

export const revokeAdminKey = async (id: string) => {
  return prisma.apikey.delete({
    where: {
      id
    }
  })
}