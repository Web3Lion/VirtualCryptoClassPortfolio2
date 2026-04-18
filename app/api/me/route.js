import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStudentByEmail } from '@/lib/sheets';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const isTeacher = session.user.email === process.env.TEACHER_EMAIL;
  const studentName = await getStudentByEmail(session.user.email);

  return Response.json({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    isTeacher,
    studentName,
  });
}