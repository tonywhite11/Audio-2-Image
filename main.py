from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
import os
from openai import AsyncOpenAI
import httpx
import asyncio

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Groq client
groq_client = AsyncOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY")
)

# Together client
together_client = AsyncOpenAI(
    api_key=os.getenv("TOGETHER_API_KEY"),
    base_url="https://api.together.xyz/v1"
)

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

async def refine_single_prompt(prompt):
    try:
        chat_completion = await groq_client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that helps refine prompts for image generation. Your task is to take the user's input and create a detailed, vivid description that can be used to generate an interesting and visually appealing image. Focus on adding visual details, style suggestions, and mood elements. return only the refined prompt in between <refined_prompt></refined_prompt> tags."
                },
                {
                    "role": "user",
                    "content": f"Refine this prompt for image generation: {prompt}"
                }
            ]
        )
        refined_prompt = chat_completion.choices[0].message.content
        refined_prompt = refined_prompt.strip()
        if refined_prompt.startswith("<refined_prompt>") and refined_prompt.endswith("</refined_prompt>"):
            refined_prompt = refined_prompt[len("<refined_prompt>"):-len("</refined_prompt>")].strip()
        return refined_prompt
    except Exception as e:
        print(f"Error refining prompt: {str(e)}")
        return prompt  # Return original prompt if refinement fails

@app.post("/refine_prompt")
async def refine_prompt(prompt: str = Form(...), n: int = Form(1)):
    try:
        tasks = [refine_single_prompt(prompt) for _ in range(n)]
        refined_prompts = await asyncio.gather(*tasks)
        return JSONResponse(content={"refined_prompts": refined_prompts})
    except Exception as e:
        print(f"Error refining prompts: {str(e)}")
        return JSONResponse(content={"error": "Failed to refine prompts"}, status_code=500)

@app.post("/generate")
async def generate_image(prompt: str = Form(...), n: int = Form(1)):
    try:
        response = await together_client.images.generate(
            prompt=prompt,
            model="black-forest-labs/FLUX.1-schnell",
            n=n,
        )

        image_urls = [img.url for img in response.data]
        return JSONResponse(content={"image_urls": image_urls})
    except Exception as e:
        print(f"Error generating image: {str(e)}")
        return JSONResponse(content={"error": "Failed to generate image"}, status_code=500)

@app.get("/proxy_image")
async def proxy_image(url: str):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            return StreamingResponse(response.iter_bytes(), media_type=response.headers.get('content-type'))
        except httpx.HTTPError as e:
            raise HTTPException(status_code=400, detail=f"Error fetching image: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)