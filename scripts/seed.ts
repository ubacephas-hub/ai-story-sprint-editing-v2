/**
 * Standalone database seeding script.
 * Run with: npx tsx scripts/seed.ts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const APP_NAME = "AI StorySprint Editing";

const COURSE_STRUCTURE = [
  { module: "Tools & Glossary", lessons: ["Tools & Glossary"] },
  { module: "Laptop Version", lessons: ["Prompt Generation", "Image Generation", "Importing & Editing"] },
  { module: "Phone Version", lessons: ["Prompt Generation", "Image Generation", "Importing & Editing"] },
  { module: "Prompt Adjustment", lessons: ["Prompt Adjustment"] },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("🔌 Connecting to database...");
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    console.log("🌱 Starting database seed...\n");

    // 1. Create or get course
    console.log("📚 Creating course...");
    let courseRow = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.slug, "ai-storysprint-editing"))
      .limit(1);

    let courseId: number;
    if (courseRow.length === 0) {
      const [newCourse] = await db
        .insert(schema.courses)
        .values({
          title: APP_NAME,
          description: "Master the AI StorySprint editing workflow.",
          slug: "ai-storysprint-editing",
        })
        .returning();
      courseId = newCourse.id;
      console.log(`   ✓ Created course: ${APP_NAME} (ID: ${courseId})`);
    } else {
      courseId = courseRow[0].id;
      console.log(`   ✓ Course already exists: ${APP_NAME} (ID: ${courseId})`);
    }

    // 2. Create modules and lessons
    console.log("\n📖 Creating modules and lessons...");
    let totalModules = 0;
    let totalLessons = 0;
    let lessonNum = 1;

    for (let mp = 0; mp < COURSE_STRUCTURE.length; mp++) {
      const { module: moduleTitle, lessons: lessonTitles } = COURSE_STRUCTURE[mp];

      let modRow = await db
        .select()
        .from(schema.modules)
        .where(sql`${schema.modules.courseId} = ${courseId} AND ${schema.modules.position} = ${mp + 1}`)
        .limit(1);

      let modId: number;
      if (modRow.length === 0) {
        const [newMod] = await db
          .insert(schema.modules)
          .values({
            courseId,
            title: moduleTitle,
            position: mp + 1,
          })
          .returning();
        modId = newMod.id;
        totalModules++;
        console.log(`   ✓ Created Module ${mp + 1}: ${moduleTitle}`);
      } else {
        modId = modRow[0].id;
        console.log(`   ✓ Module ${mp + 1} exists: ${moduleTitle}`);
      }

      for (let lp = 0; lp < lessonTitles.length; lp++) {
        const lessonTitle = lessonTitles[lp];

        const lessonRow = await db
          .select()
          .from(schema.lessons)
          .where(sql`${schema.lessons.moduleId} = ${modId} AND ${schema.lessons.position} = ${lp + 1}`)
          .limit(1);

        if (lessonRow.length === 0) {
          await db.insert(schema.lessons).values({
            moduleId: modId,
            title: lessonTitle,
            description: `Lesson ${lessonNum}: ${lessonTitle}. Add your lesson description from the admin dashboard.`,
            position: lp + 1,
          });
          totalLessons++;
          console.log(`      ✓ Created Lesson ${lessonNum}: ${lessonTitle}`);
        } else {
          console.log(`      ✓ Lesson ${lessonNum} exists: ${lessonTitle}`);
        }
        lessonNum++;
      }
    }

    // 3. Create admin user
    console.log("\n👤 Creating admin user...");
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@storysprint.local";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
    let adminRow = await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = lower(${adminEmail})`)
      .limit(1);

    if (adminRow.length === 0) {
      await db.insert(schema.users).values({
        name: "Course Administrator",
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: "admin",
      });
      console.log(`   ✓ Created admin: ${adminEmail}`);
    } else {
      console.log(`   ✓ Admin exists: ${adminEmail}`);
    }

    // 4. Create demo student
    console.log("\n👤 Creating demo student...");
    const studentEmail = process.env.SEED_STUDENT_EMAIL || "student@storysprint.local";
    const studentPassword = process.env.SEED_STUDENT_PASSWORD || "Student123!";
    let studentRow = await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = lower(${studentEmail})`)
      .limit(1);

    let studentId: number;
    if (studentRow.length === 0) {
      const [newStudent] = await db
        .insert(schema.users)
        .values({
          name: "Demo Student",
          email: studentEmail,
          passwordHash: await hashPassword(studentPassword),
          role: "student",
        })
        .returning();
      studentId = newStudent.id;
      console.log(`   ✓ Created student: ${studentEmail}`);
    } else {
      studentId = studentRow[0].id;
      console.log(`   ✓ Student exists: ${studentEmail}`);
    }

    // 5. Grant demo student active access
    console.log("\n🔓 Setting course access...");
    const accessRow = await db
      .select()
      .from(schema.courseAccess)
      .where(sql`${schema.courseAccess.userId} = ${studentId} AND ${schema.courseAccess.courseId} = ${courseId}`)
      .limit(1);

    if (accessRow.length === 0) {
      await db.insert(schema.courseAccess).values({
        userId: studentId,
        courseId,
        status: "active",
      });
      console.log(`   ✓ Granted active access to demo student`);
    } else if (accessRow[0].status !== "active") {
      await db
        .update(schema.courseAccess)
        .set({ status: "active" })
        .where(eq(schema.courseAccess.id, accessRow[0].id));
      console.log(`   ✓ Updated demo student access to active`);
    } else {
      console.log(`   ✓ Demo student already has active access`);
    }

    // 6. Final counts
    console.log("\n📊 Database counts:");
    const [coursesCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.courses);
    const [modulesCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.modules);
    const [lessonsCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.lessons);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const [adminsCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.role, "admin"));
    const [studentsCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.role, "student"));
    const [accessCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.courseAccess);

    console.log(`   Courses:       ${coursesCount.count}`);
    console.log(`   Modules:       ${modulesCount.count}`);
    console.log(`   Lessons:       ${lessonsCount.count}`);
    console.log(`   Users:         ${usersCount.count}`);
    console.log(`   - Admins:      ${adminsCount.count}`);
    console.log(`   - Students:    ${studentsCount.count}`);
    console.log(`   Course Access: ${accessCount.count}`);

    console.log("\n✅ Database seeding complete!");
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
