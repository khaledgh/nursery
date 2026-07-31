import { Redirect } from "expo-router";
import { homeRouteForRole, useAuthStore } from "../src/store/auth";

export default function Index() {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Redirect href="/(auth)/login" />;
  // `user` is persisted with the tokens, so the role is known on a cold start
  // and a teacher never flashes the parent UI before being redirected.
  return <Redirect href={homeRouteForRole(user?.role)} />;
}
