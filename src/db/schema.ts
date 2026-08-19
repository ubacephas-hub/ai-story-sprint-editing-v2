import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("student"), // 'admin' | 'student'
    accountStatus: text("account_status").notNull().default("active"), // 'active' | 'disabled'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("courses_slug_idx").on(t.slug)]
);

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  videoKind: text("video_kind").notNull().default("none"), // 'none' | 'url' | 'upload' | 'youtube'
  videoSource: text("video_source"), // URL, file path, or YouTube URL
  videoMime: text("video_mime"),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'link' | 'text' | 'document'
  title: text("title").notNull(),
  url: text("url"),
  content: text("content"),
  filePath: text("file_path"),
  description: text("description"),
  position: integer("position").notNull().default(0),
});

export const courseAccess = pgTable(
  "course_access",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // 'pending' | 'active' | 'suspended'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("course_access_user_course_idx").on(t.userId, t.courseId),
  ]
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("in_progress"), // 'in_progress' | 'completed'
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("lesson_progress_user_lesson_idx").on(t.userId, t.lessonId),
  ]
);

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});
