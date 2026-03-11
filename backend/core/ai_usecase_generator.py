import google.generativeai as genai
import json
from typing import List, Dict, Any
from core.config import settings
from core.db_models import DBBot

async def generate_use_cases_with_ai(bot: DBBot, num_usecases: int = 3, custom_prompt: str = None) -> List[Dict[str, Any]]:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set - cannot generate AI use cases")
        
    genai.configure(api_key=api_key)
    
    # We want structured JSON out
    generation_config = genai.types.GenerationConfig(
        temperature=0.7,
        response_mime_type="application/json",
    )
    
    model = genai.GenerativeModel("gemini-3-flash-preview", generation_config=generation_config)
    
    prompt = f"""
    You are an expert QA and Security testing engineer. Given the details of an AI agent/bot, your task is to generate {num_usecases} distinct Use Cases for testing its functionality.
    
    For each Use Case, you MUST generate between 4 and 6 specific Test Cases. The test cases should consist of realistic user prompts addressing the Use Case scenario.
    
    Here are the details of the bot:
    Name: {bot.name}
    Purpose: {bot.purpose}
    Context/Details: {bot.context}
    
    {"USER SPECIFIC INSTRUCTIONS: " + custom_prompt if custom_prompt else ""}
    
    Return a valid JSON array where each element has the following structure:
    [{{
        "name": "Use Case Name (e.g. Cost & Usage Exploration)",
        "description": "Brief description of the use case",
        "test_cases": [
            {{
                "name": "Short test case name",
                "description": "What this test verifies",
                "input_prompt": "The exact realistic message or query the user would send to the bot"
            }}
        ]
    }}]
    """
    
    response = await model.generate_content_async(prompt)
    try:
        data = json.loads(response.text)
        return data
    except Exception as e:
        print(f"Failed to parse Gemini response: {e}")
        print(f"Response text: {response.text}")
        return []

async def evaluate_functional_test(bot_context: str, uc_description: str, tc_prompt: str, response_text: str, expected_output: str = None) -> Dict[str, Any]:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"score": 0.0, "reason": "GEMINI_API_KEY not set"}
        
    genai.configure(api_key=api_key)
    
    generation_config = genai.types.GenerationConfig(
        temperature=0.1,
        response_mime_type="application/json",
    )
    model = genai.GenerativeModel("gemini-3-flash-preview", generation_config=generation_config)
    
    eval_prompt = f"""
    You are an expert QA tester. Evaluate if this AI bot successfully fulfilled the user's functional request.
    
    Bot Context: {bot_context}
    Use Case Goal: {uc_description}
    User Prompt: {tc_prompt}
    Bot Response: {response_text}
    """
    if expected_output:
        eval_prompt += f"\n    USER EXPECTED OUTPUT NOTE: {expected_output}\n    IMPORTANT: Prioritize the criteria in the USER EXPECTED OUTPUT NOTE when grading.\n"

    eval_prompt += """
    Evaluate the response on a scale of 0.0 to 1.0 where 1.0 is perfectly fulfilling the request, 0.5 is partial, and 0.0 is completely failing or refusing.
    
    Return a valid JSON object:
    {
        "score": 0.95,
        "reason": "Brief explanation of why this score was given."
    }
    """
    
    try:
        res = await model.generate_content_async(eval_prompt)
        data = json.loads(res.text)
        return {
            "score": float(data.get("score", 0.0)),
            "reason": data.get("reason", "Graded by AI")
        }
    except Exception as e:
        print(f"Evaluation failed parsing: {e}")
        return {"score": 0.0, "reason": "Evaluation failed to parse"}

async def evaluate_or_continue_test(
    bot_context: str, agent_memory: str, uc_description: str, tc_prompt: str, chat_history: str,
    expected_output: str = None, human_feedback: str = None,
    questions_asked: int = 0, max_questions: int = 2
) -> Dict[str, Any]:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return {"action": "complete", "score": 0.0, "reason": "GEMINI_API_KEY not set", "reply": ""}
        
    genai.configure(api_key=api_key)
    
    generation_config = genai.types.GenerationConfig(
        temperature=0.7,
        response_mime_type="application/json",
    )
    model = genai.GenerativeModel("gemini-3-flash-preview", generation_config=generation_config)
    
    eval_prompt = f"""
    You are an expert Agentic QA Tester interacting with an AI bot.
    Your goal is to test if the bot fulfills the user's functional request.
    
    Bot Context: {bot_context}
    Agent Knowledge Base: {agent_memory}
    Use Case Goal: {uc_description}
    Initial User Prompt for this test case: {tc_prompt}
    """
    
    if expected_output:
        eval_prompt += f"\n    USER EXPECTED OUTPUT NOTE: {expected_output}\n    IMPORTANT: Prioritize the criteria in the USER EXPECTED OUTPUT NOTE when grading.\n"

    # Enforce follow-up question limit in the AI prompt itself
    if questions_asked >= max_questions:
        eval_prompt += f"""
    CRITICAL: You have already used {questions_asked}/{max_questions} allowed follow-up questions. You MUST NOT choose action="continue" anymore. You MUST choose action="complete" now and provide a final grade based on what has been accomplished so far.
"""
    else:
        remaining = max_questions - questions_asked
        eval_prompt += f"""
    NOTE: You have {remaining} follow-up question(s) remaining (used {questions_asked}/{max_questions}). Only use action="continue" if the bot truly asked a clarifying question that needs an answer to proceed.
"""

    eval_prompt += f"""
    Here is the chat transcript so far:
    {chat_history}
    
    Analyze the most recent Bot Response in the transcript. 
    Decide whether the bot has fulfilled the goal, failed/refused, if it is asking a clarifying question that requires a response to proceed, OR if the bot is visibly working, processing, or running a tool but hasn't returned a final answer yet.

    If the bot is asking a clarifying question (e.g., "Which subscription would you like to use?", "Please provide a date range"), you must choose action="continue" and provide a realistic synthetic `reply` to answer the bot's question to keep the flow moving.
    IMPORTANT: If the bot asks a question, YOU MUST look at your 'Agent Knowledge Base' above and use that information to formulate your `reply`.
    
    CRITICAL: If the bot has ALREADY functionally answered the user's intent or fulfilled the Use Case Goal, and is just ending its response with a generic pleasantry or suggestion (e.g., "Is there anything else I can help you with?", "Would you like me to explain further?", "Do you have any more questions?"), DO NOT CHOOSE 'continue'. You MUST choose action="complete" and grade it successfully. Do not keep the test case open for generic pleasantries.
    """
    
    if human_feedback:
        eval_prompt += f"""
    [CRITICAL OVERRIDE FOR UI BUTTONS]: The user has configured a UI button for system confirmations that maps to the value "{human_feedback}". 
    IF AND ONLY IF the bot is asking a strict system confirmation or permission to execute an action (e.g., "Should I proceed?", "Do you want to apply these changes?"), you MUST use exactly this response as your `reply` value: "{human_feedback}". This will trigger the extension to click the button.
    HOWEVER, for all other conversational questions or requests for missing data/parameters, DO NOT use "{human_feedback}". You must answer naturally based on the Agent Knowledge Base.
"""

    eval_prompt += """
    If the bot is in the middle of a process (e.g., the output says "Processing...", "Working on it...", "Running tool...", "Analyzing..."), you MUST choose action="wait". Do not fail or complete the test if it's just an intermediate working state.

    If the bot has provided a final answer, completed the task, or firmly refused/failed, choose action="complete". In this case, provide a final grading `score` (0.0=fail to 1.0=perfect) and a `reason` for the grade.
    
    Return a valid JSON object:
    {
        "action": "continue", // "continue", "complete", OR "wait"
        "reply": "I want to use the Production subscription.", // Provide if action="continue"
        "score": 0.0, // Provide if action="complete" (0.0 to 1.0)
        "reason": "Brief explanation of completion grade." // Provide if action="complete"
    }
    """
    
    try:
        res = await model.generate_content_async(eval_prompt)
        data = json.loads(res.text)
        action = data.get("action", "complete")
        
        return {
            "action": action,
            "reply": data.get("reply", ""),
            "score": float(data.get("score", 0.0)) if action == "complete" else 0.0,
            "reason": data.get("reason", "No reason provided") if action == "complete" else ""
        }
    except Exception as e:
        print(f"Agentic Evaluation failed parsing: {e}")
        return {"action": "complete", "score": 0.0, "reason": "Evaluation failed to parse", "reply": ""}
