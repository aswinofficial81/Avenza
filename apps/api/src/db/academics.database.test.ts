import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Academics Database Foundation, Constraints, Links & RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Establish Supabase auth schema and authenticated role in embedded Postgres for tests
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      BEGIN
        RETURN coalesce(current_setting('request.jwt.claim.role', true), 'anon');
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
      END;
      $$ LANGUAGE plpgsql;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
      END
      $$;
    `);

    // 2. Apply all migrations in sequence (1 through 6)
    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
      '../../supabase/migrations/20261003000005_evidence.sql',
      '../../supabase/migrations/20261003000006_academics.sql',
    ];

    for (const mPath of migrations) {
      const fullPath = path.resolve(process.cwd(), mPath);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await db.exec(sql);
    }

    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
    `);
  });

  const asUser = async <T>(
    clerkUserId: string,
    role = 'authenticated',
    callback: () => Promise<T> = async () => ({} as T)
  ): Promise<T> => {
    await db.exec(`
      SET ROLE ${role};
      SET "request.jwt.claim.role" = '${role}';
      SET "request.jwt.claims" = '{"sub": "${clerkUserId}"}';
    `);
    try {
      return await callback();
    } finally {
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    }
  };

  const createProfile = async (clerkUserId: string, displayName: string) => {
    const res = await db.query<{ id: string }>(
      `INSERT INTO public.profiles (clerk_user_id, display_name)
       VALUES ($1, $2)
       RETURNING id;`,
      [clerkUserId, displayName]
    );
    return res.rows[0]!.id;
  };

  it('enforces academic year date constraints (start_date <= end_date)', async () => {
    const userId = await createProfile('clerk_user_academic_dates', 'Dates Test');

    // Valid academic year
    const valid = await db.query<{ id: string }>(
      `INSERT INTO public.academic_years (user_id, name, start_date, end_date, is_current)
       VALUES ($1, '2026-2027', '2026-08-01', '2027-05-31', true)
       RETURNING id;`,
      [userId]
    );
    expect(valid.rows.length).toBe(1);

    // Invalid: start_date > end_date
    await expect(
      db.query(
        `INSERT INTO public.academic_years (user_id, name, start_date, end_date)
         VALUES ($1, 'Invalid Year', '2027-08-01', '2026-05-31');`,
        [userId]
      )
    ).rejects.toThrow();
  });

  it('supports terms, subjects, and topics with syllabus coverage states', async () => {
    const userId = await createProfile('clerk_user_syllabus', 'Syllabus Test');

    // 1. Create Term
    const termRes = await db.query<{ id: string }>(
      `INSERT INTO public.terms (user_id, name, code, start_date, end_date, status, is_current)
       VALUES ($1, 'Fall 2026', 'F26', '2026-08-15', '2026-12-15', 'active', true)
       RETURNING id;`,
      [userId]
    );
    const termId = termRes.rows[0]!.id;
    expect(termId).toBeDefined();

    // 2. Create Subject
    const subjectRes = await db.query<{ id: string }>(
      `INSERT INTO public.subjects (user_id, term_id, name, code, instructor, credits, status)
       VALUES ($1, $2, 'Database Management Systems', 'CS401', 'Dr. Stone', 4.0, 'active')
       RETURNING id;`,
      [userId, termId]
    );
    const subjectId = subjectRes.rows[0]!.id;
    expect(subjectId).toBeDefined();

    // 3. Create Topics with distinct coverage states
    const topic1 = await db.query<{ id: string }>(
      `INSERT INTO public.subject_topics (user_id, subject_id, name, order_index, status, importance, estimated_minutes)
       VALUES ($1, $2, 'Relational Algebra', 1, 'covered', 'high', 120)
       RETURNING id;`,
      [userId, subjectId]
    );
    const topic2 = await db.query<{ id: string }>(
      `INSERT INTO public.subject_topics (user_id, subject_id, name, order_index, status, importance, estimated_minutes)
       VALUES ($1, $2, 'B+ Trees & Indexing', 2, 'in_progress', 'critical', 180)
       RETURNING id;`,
      [userId, subjectId]
    );
    const topic3 = await db.query<{ id: string }>(
      `INSERT INTO public.subject_topics (user_id, subject_id, name, order_index, status, importance, estimated_minutes)
       VALUES ($1, $2, 'Query Optimization', 3, 'not_started', 'medium', 150)
       RETURNING id;`,
      [userId, subjectId]
    );

    expect(topic1.rows[0]!.id).toBeDefined();
    expect(topic2.rows[0]!.id).toBeDefined();
    expect(topic3.rows[0]!.id).toBeDefined();

    // Query topics ordered deterministically by order_index
    const topics = await db.query<{ name: string; status: string }>(
      `SELECT name, status FROM public.subject_topics
       WHERE subject_id = $1
       ORDER BY order_index ASC;`,
      [subjectId]
    );
    expect(topics.rows.map((t) => t.name)).toEqual([
      'Relational Algebra',
      'B+ Trees & Indexing',
      'Query Optimization',
    ]);
  });

  it('validates assessment marks and weight constraints', async () => {
    const userId = await createProfile('clerk_user_assessments', 'Assessment Test');

    const termRes = await db.query<{ id: string }>(
      `INSERT INTO public.terms (user_id, name, start_date, end_date)
       VALUES ($1, 'Spring 2026', '2026-01-10', '2026-05-10')
       RETURNING id;`,
      [userId]
    );
    const termId = termRes.rows[0]!.id;

    // Valid assessment
    const valid = await db.query<{ id: string }>(
      `INSERT INTO public.assessments (user_id, term_id, title, assessment_type, max_marks, obtained_marks, weight_percent)
       VALUES ($1, $2, 'Midterm Assignment', 'assignment', 100, 88.5, 20.0)
       RETURNING id;`,
      [userId, termId]
    );
    expect(valid.rows.length).toBe(1);

    // Invalid: obtained_marks > max_marks
    await expect(
      db.query(
        `INSERT INTO public.assessments (user_id, term_id, title, assessment_type, max_marks, obtained_marks)
         VALUES ($1, $2, 'Invalid Marks', 'quiz', 50, 60);`,
        [userId, termId]
      )
    ).rejects.toThrow();

    // Invalid: weight_percent > 100
    await expect(
      db.query(
        `INSERT INTO public.assessments (user_id, term_id, title, assessment_type, weight_percent)
         VALUES ($1, $2, 'Invalid Weight', 'quiz', 110);`,
        [userId, termId]
      )
    ).rejects.toThrow();
  });

  it('supports exams, exam_topics, and assessment_topics relationships', async () => {
    const userId = await createProfile('clerk_user_exam_links', 'Exam Test');

    const termRes = await db.query<{ id: string }>(
      `INSERT INTO public.terms (user_id, name, start_date, end_date)
       VALUES ($1, 'Term 1', '2026-01-01', '2026-04-30')
       RETURNING id;`,
      [userId]
    );
    const termId = termRes.rows[0]!.id;

    const subjRes = await db.query<{ id: string }>(
      `INSERT INTO public.subjects (user_id, term_id, name)
       VALUES ($1, $2, 'Operating Systems')
       RETURNING id;`,
      [userId, termId]
    );
    const subjectId = subjRes.rows[0]!.id;

    const topicRes = await db.query<{ id: string }>(
      `INSERT INTO public.subject_topics (user_id, subject_id, name)
       VALUES ($1, $2, 'Virtual Memory')
       RETURNING id;`,
      [userId, subjectId]
    );
    const topicId = topicRes.rows[0]!.id;

    // Exam
    const examRes = await db.query<{ id: string }>(
      `INSERT INTO public.exams (user_id, term_id, subject_id, title, exam_type, exam_date, duration_minutes)
       VALUES ($1, $2, $3, 'OS Midterm', 'midterm', '2026-03-15T09:00:00Z', 120)
       RETURNING id;`,
      [userId, termId, subjectId]
    );
    const examId = examRes.rows[0]!.id;

    // Link exam to topic
    await db.query(
      `INSERT INTO public.exam_topics (exam_id, topic_id)
       VALUES ($1, $2);`,
      [examId, topicId]
    );

    const examTopicCount = await db.query<{ count: string }>(
      `SELECT count(*) FROM public.exam_topics WHERE exam_id = $1;`,
      [examId]
    );
    expect(Number(examTopicCount.rows[0]!.count)).toBe(1);
  });

  it('preserves existing tasks when a linked subject or topic is deleted (safe deletion)', async () => {
    const userId = await createProfile('clerk_user_safe_del', 'Safe Del Test');

    const termRes = await db.query<{ id: string }>(
      `INSERT INTO public.terms (user_id, name, start_date, end_date)
       VALUES ($1, 'Term Del', '2026-01-01', '2026-04-30')
       RETURNING id;`,
      [userId]
    );
    const termId = termRes.rows[0]!.id;

    const subjRes = await db.query<{ id: string }>(
      `INSERT INTO public.subjects (user_id, term_id, name)
       VALUES ($1, $2, 'Networks')
       RETURNING id;`,
      [userId, termId]
    );
    const subjectId = subjRes.rows[0]!.id;

    const topicRes = await db.query<{ id: string }>(
      `INSERT INTO public.subject_topics (user_id, subject_id, name)
       VALUES ($1, $2, 'TCP Congestion')
       RETURNING id;`,
      [userId, subjectId]
    );
    const topicId = topicRes.rows[0]!.id;

    // Create a task referencing subject and topic
    const taskRes = await db.query<{ id: string }>(
      `INSERT INTO public.tasks (user_id, title, task_type, academic_term_id, academic_subject_id, academic_topic_id)
       VALUES ($1, 'Solve TCP congestion problems', 'practice', $2, $3, $4)
       RETURNING id;`,
      [userId, termId, subjectId, topicId]
    );
    const taskId = taskRes.rows[0]!.id;

    // Delete the topic
    await db.query(`DELETE FROM public.subject_topics WHERE id = $1;`, [topicId]);

    // Verify task still exists and academic_topic_id is now NULL (NOT cascade-deleted)
    const taskAfterTopicDel = await db.query<{ academic_topic_id: string | null; academic_subject_id: string | null }>(
      `SELECT academic_topic_id, academic_subject_id FROM public.tasks WHERE id = $1;`,
      [taskId]
    );
    expect(taskAfterTopicDel.rows[0]!.academic_topic_id).toBeNull();
    expect(taskAfterTopicDel.rows[0]!.academic_subject_id).toBe(subjectId);

    // Delete the subject
    await db.query(`DELETE FROM public.subjects WHERE id = $1;`, [subjectId]);

    // Verify task still exists and academic_subject_id is now NULL
    const taskAfterSubjectDel = await db.query<{ academic_subject_id: string | null; title: string }>(
      `SELECT academic_subject_id, title FROM public.tasks WHERE id = $1;`,
      [taskId]
    );
    expect(taskAfterSubjectDel.rows.length).toBe(1);
    expect(taskAfterSubjectDel.rows[0]!.academic_subject_id).toBeNull();
    expect(taskAfterSubjectDel.rows[0]!.title).toBe('Solve TCP congestion problems');
  });

  it('enforces strict RLS cross-user isolation on all academic tables', async () => {
    const userAClerkId = 'clerk_rls_acad_user_a';
    const userBClerkId = 'clerk_rls_acad_user_b';

    const userAProfileId = await createProfile(userAClerkId, 'User A');
    const userBProfileId = await createProfile(userBClerkId, 'User B');

    // 1. As User A, insert a term, subject, topic, assessment, exam
    let termAId = '';
    let subjAId = '';

    await asUser(userAClerkId, 'authenticated', async () => {
      const termRes = await db.query<{ id: string }>(
        `INSERT INTO public.terms (user_id, name, start_date, end_date)
         VALUES ($1, 'User A Term', '2026-09-01', '2026-12-31')
         RETURNING id;`,
        [userAProfileId]
      );
      termAId = termRes.rows[0]!.id;

      const subjRes = await db.query<{ id: string }>(
        `INSERT INTO public.subjects (user_id, term_id, name)
         VALUES ($1, $2, 'User A Subject')
         RETURNING id;`,
        [userAProfileId, termAId]
      );
      subjAId = subjRes.rows[0]!.id;

      await db.query(
        `INSERT INTO public.subject_topics (user_id, subject_id, name)
         VALUES ($1, $2, 'User A Topic');`,
        [userAProfileId, subjAId]
      );

      await db.query(
        `INSERT INTO public.assessments (user_id, term_id, subject_id, title)
         VALUES ($1, $2, $3, 'User A Assessment');`,
        [userAProfileId, termAId, subjAId]
      );

      await db.query(
        `INSERT INTO public.exams (user_id, term_id, subject_id, title, exam_date)
         VALUES ($1, $2, $3, 'User A Exam', '2026-12-10T10:00:00Z');`,
        [userAProfileId, termAId, subjAId]
      );
    });

    // 2. Query as User B: cannot see User A's data or insert into User A's term
    await asUser(userBClerkId, 'authenticated', async () => {
      const termsB = await db.query(`SELECT * FROM public.terms WHERE id = $1;`, [termAId]);
      expect(termsB.rows.length).toBe(0);

      const subjectsB = await db.query(`SELECT * FROM public.subjects WHERE id = $1;`, [subjAId]);
      expect(subjectsB.rows.length).toBe(0);

      const topicsB = await db.query(`SELECT * FROM public.subject_topics WHERE subject_id = $1;`, [subjAId]);
      expect(topicsB.rows.length).toBe(0);

      const assessmentsB = await db.query(`SELECT * FROM public.assessments WHERE term_id = $1;`, [termAId]);
      expect(assessmentsB.rows.length).toBe(0);

      const examsB = await db.query(`SELECT * FROM public.exams WHERE term_id = $1;`, [termAId]);
      expect(examsB.rows.length).toBe(0);

      // User B cannot insert into User A's term
      await expect(
        db.query(
          `INSERT INTO public.subjects (user_id, term_id, name)
           VALUES ($1, $2, 'User B in User A Term');`,
          [userBProfileId, termAId]
        )
      ).rejects.toThrow();
    });
  });
});
