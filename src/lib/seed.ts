import { db } from "@/db";
import { users, courses, modules, lessons, courseAccess } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { hashPassword } from "./auth";

const APP_NAME = "AI StorySprint Editing";

const COURSE_STRUCTURE: Array<{ module: string; lessons: string[] }> = [
  { module: "Tools & Glossary", lessons: ["Tools & Glossary"] },
  {
    module: "Laptop Version",
    lessons: ["Prompt Generation", "Image Generation", "Importing & Editing"],
  },
  {
    module: "Phone Version",
    lessons: ["Prompt Generation", "Image Generation", "Importing & Editing"],
  },
  { module: "Prompt Adjustment", lessons: ["Prompt Adjustment"] },
];

/**
 * Idempotent database seeding function.
 * Checks each entity before inserting to avoid duplicates.
 * All operations use the same database connection for consistency.
 */
export async function seedDatabase(): Promise<{
  course: number;
  modules: number;
  lessons: number;
  admin: number;
  student: number;
  courseAccess: number;
}> {
  const counts = {
    course: 0,
    modules: 0,
    lessons: 0,
    admin: 0,
    student: 0,
    courseAccess: 0,
  };

  // 1. Create or get course
  let courseRow = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, "ai-storysprint-editing"))
    .limit(1);

  let courseId: number;
  if (courseRow.length === 0) {
    const [newCourse] = await db
      .insert(courses)
      .values({
        title: APP_NAME,
        description: "Master the AI StorySprint editing workflow.",
        slug: "ai-storysprint-editing",
      })
      .returning();
    courseId = newCourse.id;
    counts.course = 1;
  } else {
    courseId = courseRow[0].id;
  }

  // 2. Create modules and lessons
  let lessonNum = 1;
  for (let mp = 0; mp < COURSE_STRUCTURE.length; mp++) {
    const { module: moduleTitle, lessons: lessonTitles } = COURSE_STRUCTURE[mp];

    // Check if module exists
    let modRow = await db
      .select()
      .from(modules)
      .where(sql`${modules.courseId} = ${courseId} AND ${modules.position} = ${mp + 1}`)
      .limit(1);

    let modId: number;
    if (modRow.length === 0) {
      const [newMod] = await db
        .insert(modules)
        .values({
          courseId,
          title: moduleTitle,
          position: mp + 1,
        })
        .returning();
      modId = newMod.id;
      counts.modules++;
    } else {
      modId = modRow[0].id;
    }

    // Create lessons for this module
    for (let lp = 0; lp < lessonTitles.length; lp++) {
      const lessonTitle = lessonTitles[lp];

      // Check if lesson exists
      const lessonRow = await db
        .select()
        .from(lessons)
        .where(sql`${lessons.moduleId} = ${modId} AND ${lessons.position} = ${lp + 1}`)
        .limit(1);

      if (lessonRow.length === 0) {
        await db.insert(lessons).values({
          moduleId: modId,
          title: lessonTitle,
          description: `Lesson ${lessonNum}: ${lessonTitle}. Add your lesson description from the admin dashboard.`,
          position: lp + 1,
        });
        counts.lessons++;
      }
      lessonNum++;
    }
  }

  // 3. Create admin user
  const adminEmail = "admin@storysprint.local";
  let adminRow = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${adminEmail})`)
    .limit(1);

  let adminId: number;
  if (adminRow.length === 0) {
    const [newAdmin] = await db
      .insert(users)
      .values({
        name: "Course Administrator",
        email: adminEmail,
        passwordHash: await hashPassword("Admin123!"),
        role: "admin",
      })
      .returning();
    adminId = newAdmin.id;
    counts.admin = 1;
  } else {
    adminId = adminRow[0].id;
  }

  // 4. Create demo student
  const studentEmail = "student@storysprint.local";
  let studentRow = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${studentEmail})`)
    .limit(1);

  let studentId: number;
  if (studentRow.length === 0) {
    const [newStudent] = await db
      .insert(users)
      .values({
        name: "Demo Student",
        email: studentEmail,
        passwordHash: await hashPassword("Student123!"),
        role: "student",
      })
      .returning();
    studentId = newStudent.id;
    counts.student = 1;
  } else {
    studentId = studentRow[0].id;
  }

  // 5. Grant demo student active access to the course
  const accessRow = await db
    .select()
    .from(courseAccess)
    .where(sql`${courseAccess.userId} = ${studentId} AND ${courseAccess.courseId} = ${courseId}`)
    .limit(1);

  if (accessRow.length === 0) {
    await db.insert(courseAccess).values({
      userId: studentId,
      courseId,
      status: "active",
    });
    counts.courseAccess = 1;
  } else if (accessRow[0].status !== "active") {
    // Ensure it's active
    await db
      .update(courseAccess)
      .set({ status: "active" })
      .where(eq(courseAccess.id, accessRow[0].id));
    counts.courseAccess = 1;
  }

  return counts;
}

/**
 * Get current database counts for verification
 */
export async function getDatabaseCounts(): Promise<{
  courses: number;
  modules: number;
  lessons: number;
  users: number;
  admins: number;
  students: number;
  courseAccess: number;
}> {
  const [coursesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(courses);
  const [modulesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(modules);
  const [lessonsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessons);
  const [usersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  const [adminsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "admin"));
  const [studentsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "student"));
  const [accessCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(courseAccess);

  return {
    courses: Number(coursesCount.count),
    modules: Number(modulesCount.count),
    lessons: Number(lessonsCount.count),
    users: Number(usersCount.count),
    admins: Number(adminsCount.count),
    students: Number(studentsCount.count),
    courseAccess: Number(accessCount.count),
  };
}
