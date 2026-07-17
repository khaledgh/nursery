import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth";

export default function Index() {
  const { accessToken } = useAuthStore();
  return accessToken ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
