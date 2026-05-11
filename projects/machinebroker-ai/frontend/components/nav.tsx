import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/listings", label: "Listings" },
  { href: "/matches", label: "Match Center" },
];

export function Nav() {
  return (
    <header className="border-b">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          MachineBroker AI
        </Link>
        <nav className="flex gap-6 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
