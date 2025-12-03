import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Running database seed...");

  // Only create demo user if explicitly configured via environment variables
  // This prevents accidental demo user creation in production
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  const name = process.env.DEMO_USER_NAME || "Demo User";

  if (!email || !password) {
    console.log(
      "ℹ️  DEMO_USER_EMAIL/PASSWORD not set - skipping demo user creation"
    );
    console.log("   This is expected for production deployments.");
    console.log("🎉 Seed completed (no demo user)!");
    return;
  }

  // Check if demo user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`✅ Demo user already exists: ${email}`);
    console.log("🎉 Seed completed!");
    return;
  }

  // Hash password with bcrypt (cost factor 12)
  const passwordHash = await bcrypt.hash(password, 12);

  // Create demo organization first
  const org = await prisma.organization.create({
    data: {
      name: "Demo Organization",
      slug: "demo-org",
    },
  });

  // Create demo user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  // Create membership linking user to org as owner
  await prisma.membership.create({
    data: {
      userId: user.id,
      orgId: org.id,
      role: "OWNER",
    },
  });

  console.log(`✅ Created demo user: ${user.email}`);
  console.log(`✅ Created demo org: ${org.name}`);
  console.log("⚠️  Remember to remove DEMO_USER_* vars for production!");
  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
