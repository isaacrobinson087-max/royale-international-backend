import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const allowedEmails = [
  "swifttings@gmail.com",
  "isaacrobinson087@gmail.com"
];

async function main() {
  for (const email of allowedEmails) {
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: null }
    });
  }

  console.log("Authorized admin accounts initialized.");
  console.log("First login for each account uses the Create Password flow.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });