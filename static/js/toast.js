function toastMessage(message, category="") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${category}`;
    toast.innerText = message;
    const toastContainer = document.querySelector("#toast-container");
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("visible");
    }, 100);
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 3000);
}
