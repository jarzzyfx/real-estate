"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic"; // Ensure dynamic rendering

function NotFoundPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return <div>{isClient ? <Content /> : <div>Loading...</div>}</div>;
}

function Content() {
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("searchTerm");

  return (
    <div>
      <h1>404 Page Not Found</h1>
      {searchTerm && <p>Search term: {searchTerm}</p>}
    </div>
  );
}

export default NotFoundPage;
