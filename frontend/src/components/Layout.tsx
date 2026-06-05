import { Outlet } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export function Layout(): React.ReactElement {
  return (
    <>
      <Header />
      <main style={{ minHeight: "calc(100vh - 160px)", padding: "32px 0" }}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
