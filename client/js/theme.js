const toggle = document.getElementById("themeToggle");

toggle.addEventListener("change", () => {

    if(toggle.checked){
        document.body.classList.remove("dark");
        document.body.classList.add("light");
        localStorage.setItem("theme","light");
    }
    else{
        document.body.classList.remove("light");
        document.body.classList.add("dark");
        localStorage.setItem("theme","dark");
    }

});

window.onload = () => {

    const saved = localStorage.getItem("theme") || "dark";
    document.body.classList.add(saved);

    toggle.checked = saved === "light";
}