import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email === process.env.TEACHER_EMAIL) return true;
      if (user.email?.endsWith("@southfayette.org")) return true;
      return false;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};
