import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/families/:id/admin/:path*",
    "/families/:id/votes/:path*",
    "/settings/:path*",
    "/notifications/:path*",
  ],
};
