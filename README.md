
  # 供应链管理系统

  ## FlowChain handoff

  This project has been evolved into the FlowChain supply-chain ERP UAT demo.

  Before continuing development, read:

  ```text
  PROJECT_HANDOFF.md
  ```

  The handoff file contains the current UAT URL, deployment notes, API endpoints, implemented workflows, security notes, and recommended next work. It intentionally does not contain API keys or server passwords.

  This is a code bundle for 供应链管理系统. The original project is available at https://www.figma.com/design/pqmQJ9oKgYJR2qOz2LkVj2/%E4%BE%9B%E5%BA%94%E9%93%BE%E7%AE%A1%E7%90%86%E7%B3%BB%E7%BB%9F.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run api` to start the local SCM API server.

  In another terminal, run `npm run dev` to start the frontend development server.

  Run `npm run build` to create a production build.

  The frontend proxies `/api` requests to `http://127.0.0.1:8787`.

  To enable real GPT responses, create `.env.local` in the project root:

  ```text
  OPENAI_API_KEY=sk-your-api-key-here
  OPENAI_MODEL=gpt-5-mini
  ```

  ## Current AI direction

  The current demo already includes SCM modules for overview, inventory, sales, forecasting, purchasing, receiving, and procurement cost.

  The right-side AI panel now has two layers:

  - Proactive insights generated from the current module context.
  - An embedded AI assistant that lets users ask follow-up questions about risks, forecasts, purchasing actions, and approval notes.

  The assistant currently uses local business context and rule-based replies. The next step is to move this behind an API endpoint and connect it to OpenAI, passing structured evidence from forecasts, inventory, supplier records, and purchase orders.

  ## API-backed demo flows

  The demo now has a small local API with persistent JSON data in `data/scm-demo.json`.

  Implemented flows:

  - Purchase order list loads from `GET /api/purchase-orders`.
  - New purchase orders are saved with `POST /api/purchase-orders`.
  - PO approval, rejection, cancellation, and supplier dispatch are saved with `PATCH /api/purchase-orders/:po/status`.
  - Receiving documents load from `GET /api/receiving-docs`.
  - New GRNs are saved with `POST /api/receiving-docs`.
  - Signing, QC completion, and inbound status updates are saved with `PATCH /api/receiving-docs/:grn`.
  - AI chat uses `POST /api/ai/chat`. If `OPENAI_API_KEY` is set, the API calls OpenAI. If not, it returns a local rule-based fallback.

  Example AI request:

  ```bash
  curl -X POST http://127.0.0.1:8787/api/ai/chat \
    -H "Content-Type: application/json" \
    -d "{\"moduleId\":\"purchasing\",\"question\":\"哪些采购单应该优先审批？\"}"
  ```
  
