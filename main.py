import os
import subprocess
import sys

def start_backend():
    # Path to the Backend directory
    backend_dir = os.path.join(os.path.dirname(__file__), "Backend")
    
    # Path to the virtual environment's python executable
    venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")
    
    if not os.path.exists(venv_python):
        print(f"Warning: Virtual environment not found at {venv_python}. Using system python.")
        venv_python = sys.executable

    print(f"--- HandyText Backend Launcher ---")
    print(f"Starting server in: {backend_dir}")
    
    try:
        # Run the backend main.py using the venv python
        # We use cwd=backend_dir so that relative imports and file paths work correctly
        subprocess.run([venv_python, "main.py"], cwd=backend_dir)
    except KeyboardInterrupt:
        print("\nBackend server stopped.")
    except Exception as e:
        print(f"Error starting backend: {e}")

if __name__ == "__main__":
    start_backend()
