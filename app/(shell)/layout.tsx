import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ActiveGroupProvider } from "@/lib/active-group";
import { TabBar } from "@/components/TabBar";

// Sekmeli kabuk: mobildeki app/(app)/(tabs) yapisinin karsiligi.
// Grup detay sayfalari (vote/teams/breakdown/match) bu kabugun disinda,
// mobildeki gibi geri linkli ayri sayfalar olarak kaliyor.
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ActiveGroupProvider>
      <div className="shell">
        {children}
        <TabBar />
      </div>
    </ActiveGroupProvider>
  );
}
