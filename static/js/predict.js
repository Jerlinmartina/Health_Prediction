// ─── INITIALIZATION ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupPredict();
});

// ═══════════════════════════════════════════════════════════════════════════
// PREDICT LOGIC
// ═══════════════════════════════════════════════════════════════════════════
function setupPredict() {
    const runPredictionBtn = document.getElementById('runPrediction');
    if (!runPredictionBtn) return;

    runPredictionBtn.addEventListener('click', async () => {
        const inputData = {
            Age: parseFloat(document.getElementById('predAge').value),
            Gender: document.getElementById('predGender').value,
            Occupation: document.getElementById('predOccupation').value,
            Monthly_Income: parseFloat(document.getElementById('predIncome').value),
            Diet_Type: document.getElementById('predDiet').value,
            Exercise_Hours_Per_Week: parseFloat(document.getElementById('predExercise').value),
            Steps_Per_Day: parseFloat(document.getElementById('predSteps').value),
            Water_Intake_Liters_Per_Day: parseFloat(document.getElementById('predWater').value),
            Sleep_Hours_Per_Day: parseFloat(document.getElementById('predSleep').value),
            Sleep_Quality: parseFloat(document.getElementById('predSleepQuality').value),
            Screen_Time_Hours_Per_Day: parseFloat(document.getElementById('predScreen').value),
            Stress_Level: parseFloat(document.getElementById('predStress').value),
            BMI: parseFloat(document.getElementById('predBMI').value),
            Calories_Per_Day: parseFloat(document.getElementById('predCalories').value),
            Resting_Heart_Rate: parseFloat(document.getElementById('predHeartRate').value),
            Smoking_Status: document.getElementById('predSmoking').value,
            Alcohol_Consumption: document.getElementById('predAlcohol').value,
            Systolic_BP: parseFloat(document.getElementById('predSBP').value),
            Diastolic_BP: parseFloat(document.getElementById('predDBP').value),
            Cholesterol_Level: parseFloat(document.getElementById('predCholesterol').value),
            Blood_Glucose: parseFloat(document.getElementById('predGlucose').value),
        };

        const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputData),
        });
        const result = await res.json();

        const el = document.getElementById('predictionResult');
        const riskClass = result.prediction.toLowerCase();
        const riskEmoji = { low: '✅', medium: '⚠️', high: '🚨' }[riskClass];
        const riskColor = { low: 'var(--accent-green)', medium: 'var(--accent-amber)', high: 'var(--accent-red)' }[riskClass];

        el.className = `prediction-result show ${riskClass}`;
        el.innerHTML = `
            <div style="font-size:3rem;margin-bottom:0.5rem;">${riskEmoji}</div>
            <h3 style="color:${riskColor}">Health Risk: ${result.prediction}</h3>
            <p style="color:var(--text-secondary);margin-top:0.5rem;">Based on the Random Forest model prediction</p>
            <div class="prob-bar">
                <div class="prob-item">
                    <div class="prob-value" style="color:var(--accent-green)">${(result.probabilities.Low * 100).toFixed(1)}%</div>
                    <div class="prob-label">Low</div>
                </div>
                <div class="prob-item">
                    <div class="prob-value" style="color:var(--accent-amber)">${(result.probabilities.Medium * 100).toFixed(1)}%</div>
                    <div class="prob-label">Medium</div>
                </div>
                <div class="prob-item">
                    <div class="prob-value" style="color:var(--accent-red)">${(result.probabilities.High * 100).toFixed(1)}%</div>
                    <div class="prob-label">High</div>
                </div>
            </div>
        `;
    });
}
