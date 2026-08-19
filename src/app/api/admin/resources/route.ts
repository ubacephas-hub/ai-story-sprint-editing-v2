import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, lessonId, title, url, content, description, position } = body;

    if (!type || !lessonId || !title) {
      return NextResponse.json(
        { error: "Type, lesson, and title are required" },
        { status: 400 }
      );
    }

    if (type === "link" && !url) {
      return NextResponse.json(
        { error: "URL is required for link resources" },
        { status: 400 }
      );
    }

    if (type === "text" && !content) {
      return NextResponse.json(
        { error: "Content is required for text resources" },
        { status: 400 }
      );
    }

    await db.insert(resources).values({
      lessonId,
      type,
      title: title.trim(),
      url: url?.trim() || null,
      content: content?.trim() || null,
      description: description?.trim() || null,
      position: Number(position) || 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add resource error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session=await getSession();if(!session||session.user.role!=="admin")return NextResponse.json({error:"Unauthorized"},{status:401});
    const {id,title,description,position}=await req.json();if(!id||typeof title!=="string"||title.trim().length<1)return NextResponse.json({error:"Resource and title are required"},{status:400});
    await db.update(resources).set({title:title.trim(),description:description?.trim()||null,position:Number(position)||0}).where(eq(resources.id,id));
    return NextResponse.json({success:true});
  } catch(error){console.error("Update resource error:",error);return NextResponse.json({error:"Resource update failed"},{status:500})}
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    await db.delete(resources).where(eq(resources.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete resource error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
