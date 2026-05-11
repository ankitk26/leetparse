import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

app.innerHTML = `
  <main style="width: 100%;">
    <h1>leetparse</h1>
    <form id="generate-form" style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
      <input
        id="leetcode-url"
        name="url"
        type="url"
        placeholder="https://leetcode.com/problems/two-sum/"
        style="width: 100%; box-sizing: border-box;"
        required
      />
      <button type="submit" style="width: 100%; box-sizing: border-box;">Generate</button>
    </form>
    <p id="status" style="width: 100%;"></p>
    <textarea
      id="output"
      placeholder="Generated C++ will appear here"
      style="width: 100%; box-sizing: border-box;"
    ></textarea>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#generate-form");
const urlInput = document.querySelector<HTMLInputElement>("#leetcode-url");
const output = document.querySelector<HTMLTextAreaElement>("#output");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (!form || !urlInput || !output || !status) {
  throw new Error("Failed to initialize the UI.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  status.textContent = "Generating...";
  output.value = "";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: urlInput.value }),
    });

    const payload = (await response.json()) as { code?: string; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }

    output.value = payload.code ?? "";
    status.textContent = "Done.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Unknown error.";
  }
});
