/* ==========================================================================
   TradeShield enquiry form — validation, capture & submission
   No backend required: submissions are stored locally so the flow is fully
   demonstrable. Swap `persistEnquiry()` for a real POST when a backend exists.
   ========================================================================== */
(function () {
  "use strict";

  const form = document.getElementById("enquiry-form");
  if (!form) return;

  const successBox = document.getElementById("form-success");
  const summaryList = document.getElementById("summary-list");

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^[\d\s()+\-]{7,}$/;

  const labels = {
    fullName:  "Full name",
    company:   "Company name",
    email:     "Email address",
    phone:     "Telephone number",
    turnover:  "Annual turnover",
    staff:     "Number of staff",
    hmrc:      "Annual HMRC liabilities",
    purchases: "Purchases & supplier costs",
  };

  function fieldWrap(el) { return el.closest(".field"); }

  function setInvalid(el, invalid) {
    const w = fieldWrap(el);
    if (w) w.classList.toggle("invalid", invalid);
  }

  function validateField(el) {
    const v = (el.value || "").trim();
    let ok = v.length > 0;
    if (ok && el.type === "email") ok = emailRe.test(v);
    if (ok && el.type === "tel")   ok = phoneRe.test(v);
    setInvalid(el, !ok);
    return ok;
  }

  const fields = Array.from(form.querySelectorAll("input, select"));

  // live-clear errors as the user fixes them
  fields.forEach((el) => {
    el.addEventListener("blur", () => validateField(el));
    el.addEventListener("input", () => {
      if (fieldWrap(el).classList.contains("invalid")) validateField(el);
    });
    el.addEventListener("change", () => validateField(el));
  });

  function persistEnquiry(data) {
    try {
      const key = "tradeshield.enquiries";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push(data);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }

  function renderSummary(data) {
    summaryList.innerHTML = "";
    const order = ["fullName", "company", "email", "phone", "turnover", "staff", "hmrc", "purchases"];
    order.forEach((k) => {
      if (!data[k]) return;
      const dt = document.createElement("dt");
      dt.textContent = labels[k];
      const dd = document.createElement("dd");
      dd.textContent = data[k];
      summaryList.appendChild(dt);
      summaryList.appendChild(dd);
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    let firstBad = null;
    fields.forEach((el) => {
      const ok = validateField(el);
      if (!ok && !firstBad) firstBad = el;
    });

    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const data = {};
    fields.forEach((el) => { data[el.name] = (el.value || "").trim(); });
    data.submittedAt = new Date().toISOString();

    persistEnquiry(data);
    renderSummary(data);

    // swap the form for the confirmation state
    form.style.display = "none";
    successBox.classList.add("show");
    successBox.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
