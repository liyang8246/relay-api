import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = registerSchema.parse(body);

    // 检查邮箱是否已存在
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // 创建用户
    const hashedPassword = await hashPassword(password);
    const userId = generateId();
    
    await db.insert(users).values({
      id: userId,
      email,
      password: hashedPassword,
      name,
    });

    // 创建 session
    const token = await createSession(userId);
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: userId, email, name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
