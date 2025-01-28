import { Webhook } from "svix";
import { headers } from "next/headers";
import { clerkClient, WebhookEvent } from "@clerk/nextjs/server";
import { createOrUpdateUser, deleteUser } from "@/lib/actions/user";
import { NextRequest, NextResponse } from "next/server";

// Define the User type if it's not imported
interface User {
  _id: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const SIGNING_SECRET = process.env.SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error(
      "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET);

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing Svix headers" },
      { status: 400 }
    );
  }

  // Get body
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("Error: Invalid JSON payload", error);
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error: Could not verify webhook:", err);
    return NextResponse.json({ error: "Verification error" }, { status: 400 });
  }

  // Process webhook event
  const { id } = evt.data as { id: string };
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { first_name, last_name, image_url, email_addresses } = evt.data as {
      first_name: string;
      last_name: string;
      image_url: string;
      email_addresses: Array<{ email_address: string }>;
    };

    const formattedEmailAddresses = email_addresses.map((emailObj) => ({
      email: emailObj.email_address,
    }));

    try {
      const user = await createOrUpdateUser(
        formattedEmailAddresses.map((emailObj) => emailObj.email).join(", "),
        first_name,
        last_name,
        image_url,
        email_addresses
      );

      if (user && eventType === "user.created") {
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(id, {
            publicMetadata: {
              userMogoId: (user as unknown as User)._id, // Explicit type assertion for User
            },
          });
        } catch (error) {
          console.error("Error: Could not update user metadata:", error);
        }
      } else if (!user) {
        console.error("Error: User creation or update returned null");
        return NextResponse.json(
          { error: "User creation or update returned null" },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("Error: Could not create or update user:", error);
      return NextResponse.json(
        { error: "Could not create or update user" },
        { status: 400 }
      );
    }
  }

  if (eventType === "user.deleted") {
    try {
      await deleteUser(id);
    } catch (error) {
      console.error("Error: Could not delete user:", error);
      return NextResponse.json(
        { error: "Could not delete user" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ message: "Webhook received" }, { status: 200 });
}
