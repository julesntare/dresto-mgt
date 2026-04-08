import type { ReactNode } from "react";
import { useAuth } from "../lib/use-auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function LoginLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return <>{children}</>;
}
