/** Public profile shape - never leaks password hashes or wrapped keys. */
export function publicUser(db, user, { withPrivate = false } = {}) {
  if (!user) return null;
  const skills = db.prepare('SELECT skill FROM skills WHERE user_id = ? ORDER BY skill').all(user.id).map((r) => r.skill);
  const stats = db
    .prepare('SELECT COUNT(*) AS count, ROUND(AVG(rating), 2) AS avg FROM reviews WHERE reviewee_id = ?')
    .get(user.id);
  const completed = db
    .prepare(
      "SELECT COUNT(*) AS n FROM contracts WHERE status = 'released' AND (student_id = ? OR entrepreneur_id = ?)",
    )
    .get(user.id, user.id).n;

  const out = {
    id: user.id,
    role: user.role,
    name: user.name,
    headline: user.headline,
    bio: user.bio,
    location: user.location,
    avatarColor: user.avatar_color,
    skills,
    rating: { average: stats.avg, count: stats.count },
    completedProjects: completed,
    plan: user.plan,
    publicKey: user.public_key,
    createdAt: user.created_at,
  };
  if (user.role === 'student') {
    Object.assign(out, {
      university: user.university,
      course: user.course,
      graduationYear: user.graduation_year,
      verified: Boolean(user.academic_verified_at),
    });
  } else {
    Object.assign(out, { company: user.company, website: user.website });
  }
  if (withPrivate) {
    Object.assign(out, {
      email: user.email,
      academicEmail: user.academic_email,
      planRenewsAt: user.plan_renews_at,
      wrappedPrivateKey: user.wrapped_private_key,
    });
  }
  return out;
}

export function setSkills(db, table, idColumn, id, skills) {
  db.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ?`).run(id);
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (${idColumn}, skill) VALUES (?, ?)`);
  for (const s of skills) {
    const clean = s.trim();
    if (clean) insert.run(id, clean);
  }
}
