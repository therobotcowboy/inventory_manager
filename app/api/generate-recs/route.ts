
import { AiService } from '@/lib/gemini';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Gemini SDK safer on Node runtime

export async function POST(req: Request) {
    try {
        const { jobDescription } = await req.json();

        if (!jobDescription) {
            return NextResponse.json({ error: "Missing job description" }, { status: 400 });
        }

        const geminiStream = await AiService.getIdealLoadoutStream(jobDescription);

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of geminiStream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            controller.enqueue(chunkText);
                        }
                    }
                    controller.close();
                } catch (err) {
                    console.error("Stream Error", err);
                    controller.error(err);
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked'
            }
        });

    } catch (error) {
        console.error("Route Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
