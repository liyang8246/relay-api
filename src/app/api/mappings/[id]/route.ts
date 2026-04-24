import { NextRequest, NextResponse } from "next/server";
import { db, modelMappings } from "@/db";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateMappingSchema = z.object({
  priority: z.number().int().min(0).optional(),
  maxConcurrency: z.number().int().min(1).optional(),
  isEnabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const updates = updateMappingSchema.parse(body);
    
    const mapping = await db.query.modelMappings.findFirst({
      where: eq(modelMappings.id, id),
    });
    
    if (!mapping || mapping.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    await db.update(modelMappings)
      .set(updates)
      .where(eq(modelMappings.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Update mapping error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    
    const mapping = await db.query.modelMappings.findFirst({
      where: eq(modelMappings.id, id),
    });
    
    if (!mapping || mapping.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    await db.delete(modelMappings).where(eq(modelMappings.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete mapping error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
