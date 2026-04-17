// Reusable colors and helper utilities for the client
const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function getActualColor(cName) {
    const map = {
        brown: "#97613c", lightblue: "#26b6f0", pink: "#ec4899",
        orange: "#f97316", red: "#ef4444", yellow: "#f59e0b",
        green: "#10b981", darkblue: "#3b82f6"
    };
    return map[cName] || "#ccc";
}

function logActivity(msg) {
    const log = document.getElementById("activity-log");
    if (!log) return;
    const div = document.createElement("div");
    div.innerText = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

window.getActualColor = getActualColor;
window.colors = colors;
window.logActivity = logActivity;
