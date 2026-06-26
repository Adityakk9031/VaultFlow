# VaultFlow 🏦

![VaultFlow](https://img.shields.io/badge/Air--Gapped-Local_Compute-0ea5e9?style=for-the-badge&logo=shield)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite)
![QVAC SDK](https://img.shields.io/badge/QVAC-Edge_AI-10b981?style=for-the-badge)

**VaultFlow** is a highly optimized, fully local, and air-gapped financial receipt and transaction processing application. Designed for privacy-first environments and zero-cloud dependency deployments, it utilizes a multi-agent AI pipeline to categorize expenses, assess financial risks, and generate actionable budget optimization advice.

---

## 🎥 Demo Video

*(Add a link to your demonstration video below)*





---

## 🌟 Key Features

* **Zero-Cloud Dependency**: Designed from the ground up for edge environments. VaultFlow guarantees privacy by ensuring no transaction data ever leaves the local machine.
* **Multi-Agent Pipeline**: 
  * **Categorizer**: Acting as the data extraction and structuring brain, this agent scans raw, unstructured text. It extracts exact merchant names, total amounts, and itemized lists, and assigns standard spending categories using local OCR and semantic fallback rule engines.
  * **Risk Assessor**: Cross-references parsed transaction totals and merchant history against strict local policy limits (e.g., $500 hard cap, $150 dining soft cap) to catch budget anomalies instantly and flag policy violations.
  * **Budget Analyst**: Synthesizes the results of the entire pipeline to produce hyper-specific, actionable micro-optimization tips tailored directly to the user's spending habits.
* **Resilient Storage Architecture**: Powered by `better-sqlite3` utilizing Write-Ahead Logging (WAL) for high concurrency, backed by an automatic JSON filesystem failover (`transactions.json`) to guarantee zero data loss.
* **Premium Glassmorphic UI**: Features a meticulously crafted Next.js dashboard with interactive log streams, animated metrics, and a dynamic ledger designed to provide a state-of-the-art user experience.
* **Dynamic Receipt Parsing**: Employs robust Regex pattern matching with localized prepositional bounding to seamlessly parse disorganized generic invoices or malformed receipt structures.

---

## 🧠 Edge AI Inference Models

VaultFlow leverages the **QVAC Edge AI SDK** to process documents completely offline. The pipeline uses two specialized, highly-quantized models designed to run efficiently on standard consumer hardware:

1. **OCR Extraction Model (`OCR_0_6B_MULTIMODAL_Q4_K_M`)**:
   * **Purpose**: Used for extracting text from physical receipt images, scans, and PDFs.
   * **Details**: A highly efficient 0.6B parameter multimodal model quantized to 4-bit (`Q4_K_M`) for rapid CPU/GPU inference. It accurately maps spatial document layouts, ensuring structured receipts are converted to clean, readable text without requiring cloud-based vision APIs.

2. **Reasoning & NLP Model (`LLAMA_3_2_1B_INST_Q4_0`)**:
   * **Purpose**: Used by the multi-agent swarm (Categorizer, Risk Assessor, and Budget Analyst) to convert unstructured text into precise JSON payloads and generate financial advice.
   * **Details**: An instruct-tuned Llama 3.2 (1B parameters) model. At 4-bit quantization, it easily fits into standard system memory, making complex semantic logic, entity extraction, and financial reasoning possible in an air-gapped environment.

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Custom Vanilla CSS Keyframe Animations
* **Backend**: Next.js Serverless Route Handlers
* **Database**: SQLite (`better-sqlite3`), Local JSON serialization failover
* **Inference Engine**: QVAC SDK (Local LLM & OCR models: `LLAMA_3_2_1B_INST_Q4_0` / `OCR_0_6B_MULTIMODAL_Q4_K_M`)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* Windows/macOS/Linux environment

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Adityakk9031/vaultflow.git](https://github.com/Adityakk9031/VaultFlow)
   cd vaultflow
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Review the `.env.local` file settings. VaultFlow operates in two modes controlled by the `USE_QVAC_SDK` environment variable:
   * **`USE_QVAC_SDK=true`**: Activates the local AI OCR and LLM inference engine. If set to `true`, the application loads the quantized local models (`OCR_0_6B_MULTIMODAL` and `LLAMA_3_2_1B`) and processes documents using offline machine learning. (Note: standard dependencies must be installed via `npm install` first, but setting this to `true` is what instructs the runtime code to use the AI OCR instead of rules).
   * **`USE_QVAC_SDK=false`**: Runs the application in ultra-fast rule-based fallback mode. This executes the optimized regex parsing pipeline, allowing you to test the multi-agent UI without loading heavy AI models or requiring a dedicated local GPU.

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open the Application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```text
VaultFlow/
├── app/                  # Next.js App Router endpoints & primary dashboard (page.tsx)
├── components/           # Reusable UI React components (AgentLogViewer, FinancialStats)
├── data/                 # SQLite database and resilient transactions.json backups
├── lib/                  # Core logic, DB handlers (db.ts), and QVAC Rule Engines (qvac.ts)
└── public/               # Static web assets
```

---

## 🧪 Testing the Pipeline

VaultFlow's anomaly detection engine is heavily configured to monitor budget thresholds. Test the engine by copying and pasting a sample transaction directly into the intake dashboard:

**Anomaly Trigger Example:**
```text
Company Name: Best Buy
Date: 2026-06-25

1x MacBook Pro   $ 1,600.00
Subtotal: 1,600.00

Receipt Total: $ 1,600.00
```
*Expected Result:* The Categorizer will extract "Best Buy", and the Risk Assessor will immediately block the transaction (RISK_FLAGGED) because the $1,600 amount exceeds the $500 local policy cap.

---

## 📄 License

This project was built for the **QVAC Edge AI Hackathon** and is licensed under the MIT License.
