
```
User clicks "Scan" in popup
        ↓
popup.js sends message to background: { action: "scan" }
        ↓
background.js forwards to content.js in the active tab
        ↓
content.js reads all inputs, sends field data back to background
        ↓
background.js hits your backend API with the field summary
        ↓
backend responds with fill values
        ↓
background.js sends those values to content.js
        ↓
content.js fills the form fields
        ↓
content.js sends "done" back, popup updates UI
```




## approach using llm later on basically
```
scanPage()  →  raw fields
                    ↓
            LLM call in background.js
            (fields + your profile)
                    ↓
            JSON mapping back
                    ↓
            fillPage(mapping) → fills by exact field name

```



## usecases;
```
Fill fields with personal data
Highlight a question + right click → AI answers it and filled in
Auto-detect you're on a job application page and show panel
```