"use strict";

/* =========================================================
   AI SMART FOOD RECALL ASSISTANT
   FINAL CLEAN SCRIPT
   ========================================================= */


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let latestRecallRecord = null;
let latestRecallData = null;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(value ?? "");
    }
}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToSection(id) {
    const element = document.getElementById(id);

    if (element) {
        element.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

window.scrollToSection = scrollToSection;


/* =========================================================
   ELEMENT HELPERS
   ========================================================= */

function getQuestionInput() {
    return document.getElementById("incident");
}


function getInvestigationButton() {
    return document.getElementById("investigateBtn");
}


function getResultBox() {
    return document.getElementById("result");
}


/* =========================================================
   GENERAL KNOWLEDGE QUESTION DETECTION
   ========================================================= */

function isKnowledgeOnlyQuestion(question) {

    const text = String(question || "")
        .toLowerCase()
        .trim()
        .replace(/\?+/g, "")
        .replace(/\s+/g, " ");

    if (!text) {
        return false;
    }

    const knowledgeQuestions = [

        "what is a food recall",

        "what are food recalls",

        "what are the common causes of food recalls",

        "what are common causes of food recalls",

        "what causes food recalls",

        "why are food recalls necessary",

        "what are common food allergens",

        "what is an allergen",

        "what is cross contamination",

        "what is food contamination",

        "what is food safety",

        "what does a class i recall mean",

        "what does a class ii recall mean",

        "what does a class iii recall mean",

        "what should be checked during an allergen recall",

        "what should a company do during a recall",

        "what information is important for food recall traceability",

        "what is important for food recall traceability",

        "why is undeclared milk a food safety concern",

        "what should be done with recalled food",

        "explain food recall",

        "explain food recalls",

        "explain food safety",

        "explain cross contamination"

    ];

    if (knowledgeQuestions.includes(text)) {
        return true;
    }


    /* -----------------------------------------------------
       FDA SEARCH COMMANDS
       ----------------------------------------------------- */

    const isFDACommand =

        text.startsWith("show ") ||

        text.startsWith("find ") ||

        text.startsWith("search ") ||

        text.startsWith("list ") ||

        text.includes("recall number") ||

        text.includes("recall record") ||

        /\bf-\d{4}-\d{4}\b/i.test(text);

    if (isFDACommand) {
        return false;
    }


    /* -----------------------------------------------------
       Recall-specific question
       ----------------------------------------------------- */

    if (isRecallContextQuestion(text)) {
        return false;
    }


    /* -----------------------------------------------------
       Generic knowledge pattern
       ----------------------------------------------------- */

    const startsAsQuestion =

        text.startsWith("what ") ||

        text.startsWith("why ") ||

        text.startsWith("how ") ||

        text.startsWith("explain ") ||

        text.startsWith("define ") ||

        text.startsWith("tell me about ") ||

        text.startsWith("describe ");

    const hasFoodTopic =

        text.includes("food") ||

        text.includes("allergen") ||

        text.includes("contamination") ||

        text.includes("foodborne") ||

        text.includes("recall");

    return startsAsQuestion && hasFoodTopic;
}


/* =========================================================
   FOLLOW-UP QUESTION ABOUT SELECTED FDA RECALL
   ========================================================= */

function isRecallContextQuestion(question) {

    const text = String(question || "")
        .toLowerCase()
        .trim()
        .replace(/\?+/g, "")
        .replace(/\s+/g, " ");

    if (!text) {
        return false;
    }


    const recallQuestions = [

        "why was the product recalled",

        "why was this product recalled",

        "why was th product recalled",

        "why was the prduct recalled",

        "why was the product recall",

        "why this product was recalled",

        "reason for this recall",

        "reason for the recall",

        "what is the reason for this recall",

        "what was the reason for this recall",

        "explain this recall",

        "explain this product recall",

        "what happened to this product",

        "what is wrong with this product",

        "what is the food safety concern",

        "what is the main food safety concern",

        "what should be checked for this recall",

        "what should be checked for this product",

        "tell me about this recall",

        "explain this product"

    ];

    if (recallQuestions.includes(text)) {
        return true;
    }


    /* -----------------------------------------------------
       More flexible matching
       ----------------------------------------------------- */

    const hasWhy = text.startsWith("why ");

    const hasProduct =
        text.includes("product") ||
        text.includes("prduct") ||
        text.includes("th product");

    const hasRecall =
        text.includes("recall") ||
        text.includes("recalled");

    if (
        hasWhy &&
        hasProduct &&
        hasRecall
    ) {
        return true;
    }


    const hasExplain =
        text.startsWith("explain ");

    if (
        hasExplain &&
        (
            hasRecall ||
            hasProduct
        )
    ) {
        return true;
    }


    return false;
}


/* =========================================================
   FDA SEARCH KEYWORD
   ========================================================= */

function getSearchKeyword(question) {

    const text =
        String(question || "")
            .toLowerCase()
            .trim();


    /* -----------------------------------------------------
       Recall number
       ----------------------------------------------------- */

    const recallMatch =
        text.match(
            /\bf-\d{4}-\d{4}\b/i
        );

    if (recallMatch) {

        return (
            `recall_number:"` +
            recallMatch[0].toUpperCase() +
            `"`
        );

    }


    /* -----------------------------------------------------
       Classification
       ----------------------------------------------------- */

    const classMatch =
        text.match(
            /\bclass\s+(i{1,3})\b/i
        );

    if (classMatch) {

        const value =
            classMatch[1].toUpperCase();

        if (value === "I") {
            return 'classification:"Class I"';
        }

        if (value === "II") {
            return 'classification:"Class II"';
        }

        if (value === "III") {
            return 'classification:"Class III"';
        }
    }


    /* -----------------------------------------------------
       Allergens
       ----------------------------------------------------- */

    const allergens = [

        "peanut",
        "milk",
        "wheat",
        "soy",
        "egg",
        "sesame",
        "almond",
        "walnut",
        "cashew",
        "tree nut"

    ];

    for (const allergen of allergens) {

        if (text.includes(allergen)) {

            return (
                `reason_for_recall:"${allergen}"`
            );

        }
    }


    /* -----------------------------------------------------
       Contamination
       ----------------------------------------------------- */

    const contaminationWords = [

        "salmonella",
        "listeria",
        "e. coli",
        "ecoli",
        "bacteria",
        "contamination",
        "contaminated",
        "glass",
        "metal"

    ];

    for (
        const word
        of contaminationWords
    ) {

        if (text.includes(word)) {

            return (
                `reason_for_recall:"${word}"`
            );

        }
    }


    /* -----------------------------------------------------
       Generic product search
       ----------------------------------------------------- */

    let cleaned =
        text

            .replace(/\bshow\b/g, "")
            .replace(/\bfind\b/g, "")
            .replace(/\bsearch\b/g, "")
            .replace(/\blist\b/g, "")
            .replace(/\bgive\b/g, "")
            .replace(/\btell\b/g, "")
            .replace(/\bme\b/g, "")
            .replace(/\babout\b/g, "")
            .replace(/\bplease\b/g, "")
            .replace(/\bfood\b/g, "")
            .replace(/\brecall\b/g, "")
            .replace(/\brecalls\b/g, "")
            .trim();

    if (!cleaned) {
        return "reason_for_recall:*";
    }

    return (
        `product_description:"${cleaned}"`
    );
}


/* =========================================================
   MAIN INVESTIGATION
   ========================================================= */

async function startInvestigation() {

    const input =
        getQuestionInput();

    const button =
        getInvestigationButton();

    const progress =
        document.getElementById(
            "agentProgress"
        );


    if (!input) {

        alert(
            "Question box was not found."
        );

        return;
    }


    const question =
        input.value.trim();


    if (!question) {

        alert(
            "Please enter a question first."
        );

        input.focus();

        return;
    }


    /* =====================================================
       IMPORTANT:
       Do NOT clear latestRecallRecord here.
       A follow-up question may need the selected recall.
       ===================================================== */


    /* =====================================================
       1. SELECTED FDA RECALL QUESTION
       ===================================================== */

    if (
        isRecallContextQuestion(question) &&
        latestRecallRecord
    ) {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Analyzing Recall...";

        }

        try {

            await openRecallQuestionRAG(
                question
            );

        }

        catch (error) {

            console.error(
                "Recall RAG error:",
                error
            );

            alert(
                "Unable to analyze the selected recall."
            );

        }

        finally {

            if (button) {

                button.disabled = false;

                button.textContent =
                    "Start Investigation";

            }

        }

        return;
    }


    /* =====================================================
       2. GENERAL KNOWLEDGE QUESTION
       ===================================================== */

    if (
        isKnowledgeOnlyQuestion(question)
    ) {

        if (button) {

            button.disabled = true;

            button.textContent =
                "Preparing Answer...";

        }

        try {

            await openGeneralRAG(
                question
            );

        }

        catch (error) {

            console.error(
                "General RAG error:",
                error
            );

            alert(
                "Unable to generate the AI answer."
            );

        }

        finally {

            if (button) {

                button.disabled = false;

                button.textContent =
                    "Start Investigation";

            }

        }

        return;
    }


    /* =====================================================
       3. FDA SEARCH
       ===================================================== */

    if (progress) {

        progress.classList.remove(
            "hidden"
        );

        resetProgress();
    }


    if (button) {

        button.disabled = true;

        button.textContent =
            "Searching...";

    }


    try {

        /* -----------------------------------------------
           Step 1
           ----------------------------------------------- */

        updateStep(
            "step1",
            "active"
        );

        await delay(250);

        updateStep(
            "step1",
            "completed"
        );


        /* -----------------------------------------------
           Step 2
           ----------------------------------------------- */

        updateStep(
            "step2",
            "active"
        );


        const keyword =
            getSearchKeyword(
                question
            );


        console.log(
            "FDA Search Keyword:",
            keyword
        );


        const response =
            await fetch(
                "/api/recall/search?keyword=" +
                encodeURIComponent(
                    keyword
                )
            );


        if (!response.ok) {

            throw new Error(
                `FastAPI returned ${response.status}`
            );
        }


        const data =
            await response.json();


        latestRecallData =
            data;


        updateStep(
            "step2",
            "completed"
        );


        /* -----------------------------------------------
           Step 3
           ----------------------------------------------- */

        updateStep(
            "step3",
            "active"
        );

        await delay(200);

        updateStep(
            "step3",
            "completed"
        );


        /* -----------------------------------------------
           Step 4
           ----------------------------------------------- */

        updateStep(
            "step4",
            "active"
        );

        await delay(200);

        updateStep(
            "step4",
            "completed"
        );


        /* -----------------------------------------------
           Step 5
           ----------------------------------------------- */

        updateStep(
            "step5",
            "active"
        );

        await delay(200);

        updateStep(
            "step5",
            "completed"
        );


        /* -----------------------------------------------
           Step 6
           ----------------------------------------------- */

        updateStep(
            "step6",
            "active"
        );

        await delay(200);

        updateStep(
            "step6",
            "completed"
        );


        /* -----------------------------------------------
           Show result
           ----------------------------------------------- */

        displayFDAResult(
            data
        );


        scrollToSection(
            "results"
        );

    }

    catch (error) {

        console.error(
            "FDA Investigation Error:",
            error
        );


        const result =
            getResultBox();


        if (result) {

            result.classList.remove(
                "hidden"
            );


            result.innerHTML = `

                <div class="error-box">

                    <h3>
                        Unable to get recall results
                    </h3>

                    <p style="
                        margin-top:8px;
                    ">
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                    <p style="
                        margin-top:8px;
                        font-size:12px;
                    ">
                        Please make sure FastAPI
                        is running on port 8001.
                    </p>

                </div>

            `;
        }

    }

    finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Start Investigation";

        }

    }
}

window.startInvestigation =
    startInvestigation;


/* =========================================================
   PROGRESS HELPERS
   ========================================================= */

function resetProgress() {

    const ids = [
        "step1",
        "step2",
        "step3",
        "step4",
        "step5",
        "step6"
    ];


    ids.forEach(id => {

        const element =
            document.getElementById(
                id
            );

        if (element) {

            element.classList.remove(
                "active",
                "completed"
            );

        }

    });

}


function updateStep(
    id,
    state
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return;
    }


    element.classList.remove(
        "active",
        "completed"
    );


    if (
        state === "active"
    ) {

        element.classList.add(
            "active"
        );

    }


    if (
        state === "completed"
    ) {

        element.classList.add(
            "completed"
        );

    }

}


/* =========================================================
   DISPLAY FDA RESULT
   ========================================================= */

function displayFDAResult(
    data
) {

    const result =
        getResultBox();


    if (!result) {
        return;
    }


    result.classList.remove(
        "hidden"
    );


    const results =
        data?.results || [];


    /* -----------------------------------------------------
       No matching record
       ----------------------------------------------------- */

    if (!results.length) {

        latestRecallRecord =
            null;


        result.innerHTML = `

            <div class="empty-box">

                <h3>
                    No matching recall found
                </h3>

                <p style="
                    margin-top:6px;
                ">
                    No FDA recall record matched
                    your search.
                </p>

            </div>

        `;


        return;
    }


    /* -----------------------------------------------------
       Save selected FDA record
       ----------------------------------------------------- */

    latestRecallRecord =
        results[0];


    const record =
        latestRecallRecord;


    /* -----------------------------------------------------
       Update result information
       ----------------------------------------------------- */

    setText(
        "confidence",
        `${results.length} Match${
            results.length === 1
                ? ""
                : "es"
        }`
    );


    setText(
        "product",
        record.product_description ||
            "Not available"
    );


    setText(
        "recallNumber",
        record.recall_number ||
            "Not available"
    );


    setText(
        "classification",
        record.classification ||
            "Not available"
    );


    setText(
        "status",
        record.status ||
            "Not available"
    );


    setText(
        "recallingFirm",
        record.recalling_firm ||
            "Not available"
    );


    setText(
        "quantity",
        record.product_quantity ||
            "Not available"
    );


    setText(
        "reason",
        record.reason_for_recall ||
            "Not available"
    );


    setText(
        "batch",
        record.code_info ||
            "Not available"
    );


    setText(
        "destination",
        record.distribution_pattern ||
            "Not available"
    );


    /* -----------------------------------------------------
       Hide duplicate results
       ----------------------------------------------------- */

    const duplicateResults =
        document.getElementById(
            "allRecallResults"
        );


    if (duplicateResults) {

        duplicateResults.innerHTML =
            "";

        duplicateResults.style.display =
            "none";

    }


    /* -----------------------------------------------------
       Hide progress after completion
       ----------------------------------------------------- */

    if (document.getElementById(
        "agentProgress"
    )) {

        document.getElementById(
            "agentProgress"
        ).classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   GENERAL RAG
   ========================================================= */

async function openGeneralRAG(
    question
) {

    /*
       General RAG always gets an empty
       recall object.
    */

    const modal =
        createModal(
            "🧠",
            "Food Safety Answer"
        );


    const body =
        modal.querySelector(
            ".modal-body"
        );


    body.innerHTML = `

        <div class="rag-question-box">

            <small>
                Your Question
            </small>

            <div style="
                margin-top:5px;
            ">
                ${escapeHTML(
                    question
                )}
            </div>

        </div>


        <div class="loading">

            <div class="spinner"></div>

            <strong>
                Preparing answer...
            </strong>

            <p style="
                margin-top:6px;
                color:#7a8495;
                font-size:12px;
            ">
                Please wait.
            </p>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    try {

        const response =
            await fetch(
                "/api/rag/answer",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            question:
                                question,

                            recall: {}
                        })

                }
            );


        if (!response.ok) {

            throw new Error(
                `RAG API returned ${response.status}`
            );
        }


        const data =
            await response.json();


        body.innerHTML =
            renderGeneralRAGAnswer(
                question,
                data.answer ||
                    "No answer generated."
            );

    }

    catch (error) {

        console.error(
            "General RAG error:",
            error
        );


        body.innerHTML = `

            <div class="error-box">

                <h3>
                    Unable to generate answer
                </h3>

                <p style="
                    margin-top:8px;
                ">
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}

window.openGeneralRAG =
    openGeneralRAG;


/* =========================================================
   GENERAL RAG ANSWER
   ========================================================= */

function renderGeneralRAGAnswer(
    question,
    answer
) {

    return `

        <div class="rag-question-box">

            <small>
                Your Question
            </small>

            <div style="
                margin-top:5px;
            ">
                ${escapeHTML(
                    question
                )}
            </div>

        </div>


        <div class="rag-answer">

            <h3>
                AI Answer
            </h3>

            <div class="rag-content">

                ${markdownToHTML(
                    answer
                )}

            </div>

        </div>


        <div class="modal-note">

            This answer is generated from
            the food-safety knowledge available
            to the assistant.

        </div>

    `;

}


/* =========================================================
   RECALL FOLLOW-UP QUESTION
   ========================================================= */

async function openRecallQuestionRAG(
    question
) {

    if (!latestRecallRecord) {

        alert(
            "Please search for a food recall first."
        );

        return;

    }


    const record =
        latestRecallRecord;


    const modal =
        createModal(
            "🧠",
            "Recall Analysis"
        );


    const body =
        modal.querySelector(
            ".modal-body"
        );


    body.innerHTML = `

        <div class="rag-question-box">

            <small>
                Your Question
            </small>

            <div style="
                margin-top:5px;
            ">
                ${escapeHTML(
                    question
                )}
            </div>

        </div>


        <div class="loading">

            <div class="spinner"></div>

            <strong>
                Analyzing selected recall...
            </strong>

            <p style="
                margin-top:6px;
                color:#7a8495;
                font-size:12px;
            ">
                Using the selected FDA recall
                and food-safety knowledge.
            </p>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    try {

        const response =
            await fetch(
                "/api/rag/answer",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            question:
                                question,

                            recall:
                                record

                        })

                }
            );


        if (!response.ok) {

            throw new Error(
                `RAG API returned ${response.status}`
            );
        }


        const data =
            await response.json();


        body.innerHTML =
            renderRecallAnalysis(
                data.answer ||
                    "No analysis generated.",
                record
            );

    }

    catch (error) {

        console.error(
            "Recall RAG error:",
            error
        );


        body.innerHTML = `

            <div class="error-box">

                <h3>
                    Unable to analyze recall
                </h3>

                <p style="
                    margin-top:8px;
                ">
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}

window.openRecallQuestionRAG =
    openRecallQuestionRAG;


/* =========================================================
   AI ANALYSIS BUTTON
   ========================================================= */

async function openRAGKnowledge() {

    if (!latestRecallRecord) {

        alert(
            "Please search for a food recall first."
        );

        return;

    }


    const record =
        latestRecallRecord;


    const analysisQuestion =
        "Explain why this food product was recalled, " +
        "identify the main food-safety concern, " +
        "and explain what recall and traceability " +
        "information should be reviewed.";


    const modal =
        createModal(
            "🧠",
            "Food Recall Analysis"
        );


    const body =
        modal.querySelector(
            ".modal-body"
        );


    body.innerHTML = `

        <div class="rag-question-box">

            <small>
                Selected Recall
            </small>

            <div style="
                margin-top:5px;
            ">
                ${escapeHTML(
                    record.product_description ||
                    "Selected FDA recall"
                )}
            </div>

        </div>


        <div class="loading">

            <div class="spinner"></div>

            <strong>
                Analyzing recall...
            </strong>

            <p style="
                margin-top:6px;
                color:#7a8495;
                font-size:12px;
            ">
                Preparing an AI-assisted explanation.
            </p>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    try {

        const response =
            await fetch(
                "/api/rag/answer",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            question:
                                analysisQuestion,

                            recall:
                                record

                        })

                }
            );


        if (!response.ok) {

            throw new Error(
                `RAG API returned ${response.status}`
            );
        }


        const data =
            await response.json();


        body.innerHTML =
            renderRecallAnalysis(
                data.answer ||
                    "No analysis generated.",
                record
            );

    }

    catch (error) {

        console.error(
            "AI Analysis error:",
            error
        );


        body.innerHTML = `

            <div class="error-box">

                <h3>
                    Unable to analyze recall
                </h3>

                <p style="
                    margin-top:8px;
                ">
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}

window.openRAGKnowledge =
    openRAGKnowledge;


/* =========================================================
   RENDER RECALL ANALYSIS
   ========================================================= */

function renderRecallAnalysis(
    answer,
    record
) {

    return `

        <div class="rag-answer">

            <h3>
                AI Analysis
            </h3>

            <div class="rag-content">

                ${markdownToHTML(
                    answer
                )}

            </div>

        </div>


        <div style="
            margin-top:20px;
        ">

            <h3 style="
                font-size:16px;
                margin-bottom:10px;
            ">
                Recall Information
            </h3>


            <div class="modal-context">

                ${contextItem(
                    "Product",
                    record.product_description
                )}

                ${contextItem(
                    "Recall Number",
                    record.recall_number
                )}

                ${contextItem(
                    "Reason",
                    record.reason_for_recall
                )}

                ${contextItem(
                    "Classification",
                    record.classification
                )}

                ${contextItem(
                    "Status",
                    record.status
                )}

                ${contextItem(
                    "Batch / Code",
                    record.code_info
                )}

                ${contextItem(
                    "Quantity",
                    record.product_quantity
                )}

                ${contextItem(
                    "Distribution",
                    record.distribution_pattern
                )}

            </div>

        </div>


        <div class="modal-note">

            AI-generated information is provided
            for assistance. Final recall decisions
            require appropriate human review.

        </div>

    `;

}


/* =========================================================
   TRACEABILITY
   ========================================================= */

function openTraceability() {

    if (!latestRecallRecord) {

        alert(
            "Please run an FDA recall search first."
        );

        return;

    }


    const record =
        latestRecallRecord;


    const modal =
        createModal(
            "🔗",
            "Product Traceability"
        );


    const body =
        modal.querySelector(
            ".modal-body"
        );


    body.innerHTML = `

        <div class="modal-context">

            ${contextItem(
                "Product",
                record.product_description
            )}

            ${contextItem(
                "Recalling Firm",
                record.recalling_firm
            )}

            ${contextItem(
                "Recall Number",
                record.recall_number
            )}

            ${contextItem(
                "Batch / Code",
                record.code_info
            )}

            ${contextItem(
                "Quantity",
                record.product_quantity
            )}

            ${contextItem(
                "Distribution",
                record.distribution_pattern
            )}

            ${contextItem(
                "Classification",
                record.classification
            )}

            ${contextItem(
                "Status",
                record.status
            )}

        </div>


        <div class="modal-note">

            Distribution information from the FDA
            recall record does not necessarily
            provide individual shipment transaction
            records.

        </div>

    `;


    document.body.appendChild(
        modal
    );

}

window.openTraceability =
    openTraceability;


/* =========================================================
   REPORT
   ========================================================= */

function generateReport() {

    if (!latestRecallRecord) {

        alert(
            "Please run an FDA recall search first."
        );

        return;

    }


    const record =
        latestRecallRecord;


    const modal =
        createModal(
            "📄",
            "Food Recall Report"
        );


    const body =
        modal.querySelector(
            ".modal-body"
        );


    body.innerHTML = `

        <div class="modal-context">

            ${contextItem(
                "Product",
                record.product_description
            )}

            ${contextItem(
                "Recall Number",
                record.recall_number
            )}

            ${contextItem(
                "Classification",
                record.classification
            )}

            ${contextItem(
                "Status",
                record.status
            )}

            ${contextItem(
                "Recalling Firm",
                record.recalling_firm
            )}

            ${contextItem(
                "Quantity",
                record.product_quantity
            )}

            ${contextItem(
                "Batch / Code",
                record.code_info
            )}

            ${contextItem(
                "Distribution",
                record.distribution_pattern
            )}

            ${contextItem(
                "Reason",
                record.reason_for_recall
            )}

        </div>


        <div style="
            margin-top:20px;
            display:flex;
            gap:10px;
            flex-wrap:wrap;
        ">

            <button
                class="start-button"
                onclick="printReport()"
            >
                Print Report
            </button>


            <button
                class="result-action"
                style="
                    background:#f1f3f6;
                    color:#344054;
                "
                onclick="closeAllModals()"
            >
                Close
            </button>

        </div>

    `;


    document.body.appendChild(
        modal
    );

}

window.generateReport =
    generateReport;


/* =========================================================
   PRINT REPORT
   ========================================================= */

function printReport() {

    if (!latestRecallRecord) {
        return;
    }


    const record =
        latestRecallRecord;


    const printWindow =
        window.open(
            "",
            "_blank",
            "width=850,height=700"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups to print the report."
        );

        return;
    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                Food Recall Investigation Report
            </title>

            <style>

                body {
                    font-family:
                        Arial,
                        sans-serif;

                    padding:40px;

                    color:#172033;
                }

                h1 {
                    margin-bottom:25px;
                }

                .row {
                    padding:13px 0;

                    border-bottom:
                        1px solid #ddd;
                }

                .label {
                    font-size:10px;

                    color:#667085;

                    text-transform:
                        uppercase;

                    font-weight:bold;
                }

                .value {
                    margin-top:5px;

                    font-size:14px;
                }

            </style>

        </head>


        <body>

            <h1>
                Food Recall Investigation Report
            </h1>


            <div class="row">

                <div class="label">
                    Product
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.product_description
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Recall Number
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.recall_number
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Classification
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.classification
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Status
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.status
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Recalling Firm
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.recalling_firm
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Quantity
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.product_quantity
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Batch / Code
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.code_info
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Distribution
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.distribution_pattern
                    )}
                </div>

            </div>


            <div class="row">

                <div class="label">
                    Reason for Recall
                </div>

                <div class="value">
                    ${escapeHTML(
                        record.reason_for_recall
                    )}
                </div>

            </div>

        </body>

        </html>

    `);


    printWindow.document.close();

    printWindow.focus();


    setTimeout(() => {

        printWindow.print();

    }, 300);

}

window.printReport =
    printReport;


/* =========================================================
   CREATE MODAL
   ========================================================= */

function createModal(
    icon,
    title
) {

    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "modal-overlay";


    const id =
        "modal-" +
        Date.now() +
        "-" +
        Math.floor(
            Math.random() * 10000
        );


    modal.id =
        id;


    modal.innerHTML = `

        <div class="modal">

            <div class="modal-top">

                <div class="modal-title">

                    <div class="modal-icon">
                        ${escapeHTML(
                            icon
                        )}
                    </div>

                    <div>

                        <h2>
                            ${escapeHTML(
                                title
                            )}
                        </h2>

                    </div>

                </div>


                <button
                    class="close"
                    aria-label="Close"
                >
                    ×
                </button>

            </div>


            <div class="modal-body"></div>

        </div>

    `;


    const closeButton =
        modal.querySelector(
            ".close"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {
                modal.remove();
            }
        );

    }


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modal
            ) {

                modal.remove();

            }

        }
    );


    return modal;

}


/* =========================================================
   CONTEXT ITEM
   ========================================================= */

function contextItem(
    label,
    value
) {

    return `

        <div class="context-item">

            <small>
                ${escapeHTML(label)}
            </small>

            <strong>
                ${escapeHTML(
                    value ||
                    "Not available"
                )}
            </strong>

        </div>

    `;

}


/* =========================================================
   CLOSE MODALS
   ========================================================= */

function closeAllModals() {

    document
        .querySelectorAll(
            ".modal-overlay"
        )
        .forEach(
            modal => {
                modal.remove();
            }
        );

}

window.closeAllModals =
    closeAllModals;


/* =========================================================
   MARKDOWN FORMATTER
   ========================================================= */

function markdownToHTML(
    text
) {

    let safe =
        escapeHTML(
            text || ""
        );


    /* Headings */

    safe =
        safe.replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        );


    safe =
        safe.replace(
            /^## (.*)$/gm,
            "<h2>$1</h2>"
        );


    safe =
        safe.replace(
            /^# (.*)$/gm,
            "<h1>$1</h1>"
        );


    /* Bold */

    safe =
        safe.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    /* Bullet points */

    const lines =
        safe.split("\n");


    let html = "";

    let inList = false;


    for (const line of lines) {

        const trimmed =
            line.trim();


        if (
            trimmed.startsWith("- ")
        ) {

            if (!inList) {

                html += "<ul>";

                inList = true;

            }


            html +=
                "<li>" +
                trimmed.substring(2) +
                "</li>";

        }

        else {

            if (inList) {

                html += "</ul>";

                inList = false;

            }


            if (trimmed) {

                html +=
                    "<p>" +
                    trimmed +
                    "</p>";

            }

        }

    }


    if (inList) {
        html += "</ul>";
    }


    return html;

}


/* =========================================================
   ENTER KEY SUPPORT
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const input =
            getQuestionInput();


        if (!input) {
            return;
        }


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    startInvestigation();

                }

            }
        );

    }
);


/* =========================================================
   ESC KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeAllModals();

        }

    }
);