import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dresto.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@dresto.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`Seeded admin user: ${admin.email}`);

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: "cat-food" },
      update: {},
      create: { id: "cat-food", name: "Food", description: "Main dishes and snacks" },
    }),
    prisma.category.upsert({
      where: { id: "cat-drinks" },
      update: {},
      create: { id: "cat-drinks", name: "Drinks", description: "Beverages and refreshments" },
    }),
  ]);

  console.log(`Seeded ${categories.length} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
