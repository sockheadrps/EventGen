from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
import sys
import tempfile
import uuid
import shutil
import glob
from typing import Dict, Any, List
from pathlib import Path

# Add parent directory to path to allow importing wsprot
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from wsprot.schema import Protocol
    from wsprot.generator import ProtocolGenerator
except ImportError as e:
    print(f"Error importing wsprot: {e}")
    # Fallback for dev environment if path hacking fails (shouldn't if structure is correct)

app = FastAPI()

# Store session paths: sessionId -> temp_dir_path
sessions: Dict[str, str] = {}

class GenerateRequest(BaseModel):
    yaml: str
    options: Dict[str, Any] = {}

# Mount the alpine_web_builder directory as static files
# We need to go up one level from 'server' to find 'alpine_web_builder'
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(base_dir, "alpine_web_builder")

# Mount static first
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.post("/api/generate")
async def generate_code(request: GenerateRequest):
    try:
        # Validate protocol FIRST
        protocol = Protocol.from_yaml(request.yaml)
        generator = ProtocolGenerator(protocol)
        
        # Create temp dir
        temp_dir = tempfile.mkdtemp(prefix="wsprot_gen_")
        session_id = str(uuid.uuid4())
        
        # Parse options
        integrate_client = request.options.get("integrate_webclient", False)
        include_server = request.options.get("include_server", True)
        include_client = request.options.get("include_client", True)
        include_webclient = request.options.get("include_webclient", True)

        tmpdir = tempfile.mkdtemp(prefix="wsprot_gen_")
        output_dir = Path(tmpdir) / "generated"
        output_dir.mkdir()
        
        # Save source YAML
        with open(output_dir / "protocol.yaml", "w", encoding="utf-8") as f:
            f.write(request.yaml)
        
        # Generate code
        generator = ProtocolGenerator(protocol)
        generator.write_all(str(output_dir), 
                          integrate_webclient=integrate_client,
                          include_server=include_server,
                          include_client=include_client,
                          include_webclient=include_webclient)
        
        # Store in session
        session_id = str(uuid.uuid4())
        sessions[session_id] = str(output_dir)
        
        return {"success": True, "sessionId": session_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.get("/api/session/{session_id}")
async def get_session_structure(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    path = sessions[session_id]
    
    def get_structure(dir_path):
        items = []
        try:
            for entry in os.scandir(dir_path):
                if entry.is_dir():
                    items.append({
                        "name": entry.name,
                        "type": "directory",
                        "children": get_structure(entry.path)
                    })
                else:
                    items.append({
                        "name": entry.name,
                        "type": "file",
                        "path": os.path.relpath(entry.path, path).replace("\\", "/") # normalize for frontend
                    })
        except Exception as e:
            print(f"Error scanning {dir_path}: {e}")
        
        # Sort directories first, then files
        return sorted(items, key=lambda x: (x["type"] != "directory", x["name"]))

    return {"files": get_structure(path)}

@app.get("/api/download/{session_id}")
async def download_zip(session_id: str, targets: str = "server,client,webclient"):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    base_path = sessions[session_id]
    target_list = targets.split(',')
    
    # Create a temp zip file
    zip_filename = f"wsprot_{session_id[:8]}.zip"
    zip_path = os.path.join(tempfile.gettempdir(), zip_filename)
    
    import zipfile
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for target in target_list:
            target_path = os.path.join(base_path, target.strip())
            if not os.path.exists(target_path):
                continue
                
            if os.path.isdir(target_path):
                for root, _, files in os.walk(target_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Archive name should be relative to base_path (e.g., server/models.py)
                        arcname = os.path.relpath(file_path, base_path)
                        zipf.write(file_path, arcname)
            elif os.path.isfile(target_path):
                # Single file
                arcname = os.path.relpath(target_path, base_path)
                zipf.write(target_path, arcname)
                        
    return FileResponse(zip_path, filename=zip_filename, media_type='application/zip')

@app.get("/api/session/{session_id}/file")
async def get_file_content(session_id: str, path: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    base_path = sessions[session_id]
    # Basic security check
    safe_path = os.path.abspath(os.path.join(base_path, path))
    if not safe_path.startswith(os.path.abspath(base_path)):
        raise HTTPException(status_code=403, detail="Invalid path")
        
    if not os.path.exists(safe_path) or not os.path.isfile(safe_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    with open(safe_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    return {"content": content}

@app.get("/")
async def read_root():
    return FileResponse(os.path.join(static_dir, "index.html"))

# Serve viewer.html explicitly if requested (in case it's not picked up by static mount or to be safe)
@app.get("/viewer.html")
async def read_viewer():
    return FileResponse(os.path.join(static_dir, "viewer.html"))

# Mount root for other static files (styles, script)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="site")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
