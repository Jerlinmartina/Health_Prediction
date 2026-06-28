/**
 * HealthViz AI — Interactive Dashboard JavaScript
 * Handles tab switching, API calls, Chart.js rendering, and user interactions.
 */

// ─── GLOBALS ────────────────────────────────────────────────────────────────
const COLORS = {
    cyan:   { bg: 'rgba(6, 182, 212, 0.6)',   border: 'rgba(6, 182, 212, 1)' },
    purple: { bg: 'rgba(139, 92, 246, 0.6)',  border: 'rgba(139, 92, 246, 1)' },
    pink:   { bg: 'rgba(236, 72, 153, 0.6)',  border: 'rgba(236, 72, 153, 1)' },
    amber:  { bg: 'rgba(245, 158, 11, 0.6)',  border: 'rgba(245, 158, 11, 1)' },
    green:  { bg: 'rgba(34, 197, 94, 0.6)',   border: 'rgba(34, 197, 94, 1)' },
    blue:   { bg: 'rgba(59, 130, 246, 0.6)',  border: 'rgba(59, 130, 246, 1)' },
    red:    { bg: 'rgba(239, 68, 68, 0.6)',   border: 'rgba(239, 68, 68, 1)' },
    teal:   { bg: 'rgba(20, 184, 166, 0.6)',  border: 'rgba(20, 184, 166, 1)' },
};

const CLUSTER_COLORS = [
    COLORS.cyan, COLORS.purple, COLORS.pink, COLORS.amber,
    COLORS.green, COLORS.blue, COLORS.red, COLORS.teal,
    { bg: 'rgba(168, 85, 247, 0.6)', border: 'rgba(168, 85, 247, 1)' },
    { bg: 'rgba(14, 165, 233, 0.6)', border: 'rgba(14, 165, 233, 1)' },
];

const NOISE_COLOR = { bg: 'rgba(100, 116, 139, 0.3)', border: 'rgba(100, 116, 139, 0.6)' };

// Chart instance store — destroy before re-creating
const charts = {};

function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

// ─── CHART.JS DEFAULTS ─────────────────────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.animation = { duration: 800, easing: 'easeOutQuart' };

// ─── UTILITY ────────────────────────────────────────────────────────────────
function showLoading(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Processing...</p></div>';
}

function renderMetrics(containerId, metrics) {
    const el = document.getElementById(containerId);
    el.innerHTML = metrics.map(m => `
        <div class="metric-badge">
            <div>
                <div class="metric-value">${m.value}</div>
                <div class="metric-label">${m.label}</div>
            </div>
        </div>
    `).join('');
}

async function fetchJSON(url) {
    const res = await fetch(url);
    return res.json();
}

// ─── INITIALIZATION ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Load all sections on initialization since they are all displayed on the overview page
    loadOverview();
    loadKMeans();
    loadDBSCAN();
    loadPCA();
    loadRF();
});

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════
async function loadOverview() {
    const data = await fetchJSON('/api/data-summary');

    renderMetrics('overviewMetrics', [
        { value: data.total_records, label: 'Total Records' },
        { value: data.total_features, label: 'Features' },
        { value: data.numeric_stats.BMI.mean, label: 'Avg BMI' },
        { value: data.numeric_stats.Resting_Heart_Rate.mean, label: 'Avg Heart Rate' },
        { value: data.numeric_stats.Sleep_Hours_Per_Day.mean, label: 'Avg Sleep (hrs)' },
        { value: data.numeric_stats.Steps_Per_Day.mean, label: 'Avg Steps/Day' },
    ]);

    // Load unfiltered charts
    loadFilteredCharts();

    // Bind filter button
    document.getElementById('applyFilters').addEventListener('click', loadFilteredCharts);
}

async function loadFilteredCharts() {
    const params = new URLSearchParams({
        gender: document.getElementById('filterGender').value,
        occupation: document.getElementById('filterOccupation').value,
        diet_type: document.getElementById('filterDiet').value,
        age_min: document.getElementById('filterAgeMin').value,
        age_max: document.getElementById('filterAgeMax').value,
    });

    const data = await fetchJSON(`/api/filter-data?${params}`);

    // BMI Histogram
    destroyChart('filterBmiChart');
    const bmiHist = buildHistogram(data.bmi_values, 10);
    charts['filterBmiChart'] = new Chart(document.getElementById('filterBmiChart'), {
        type: 'bar',
        data: {
            labels: bmiHist.labels,
            datasets: [{
                label: `BMI Distribution (${data.total_records} records)`,
                data: bmiHist.counts,
                backgroundColor: COLORS.cyan.bg,
                borderColor: COLORS.cyan.border,
                borderWidth: 2,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Count' } },
                x: { grid: { display: false }, title: { display: true, text: 'BMI Range' } }
            }
        }
    });

    // Sleep Histogram
    destroyChart('filterSleepChart');
    const sleepHist = buildHistogram(data.sleep_values, 8);
    charts['filterSleepChart'] = new Chart(document.getElementById('filterSleepChart'), {
        type: 'bar',
        data: {
            labels: sleepHist.labels,
            datasets: [{
                label: `Sleep Hours (${data.total_records} records)`,
                data: sleepHist.counts,
                backgroundColor: COLORS.purple.bg,
                borderColor: COLORS.purple.border,
                borderWidth: 2,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Count' } },
                x: { grid: { display: false }, title: { display: true, text: 'Hours' } }
            }
        }
    });
}

function buildHistogram(values, numBins) {
    if (!values || values.length === 0) return { labels: [], counts: [] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / numBins || 1;
    const counts = new Array(numBins).fill(0);
    const labels = [];

    for (let i = 0; i < numBins; i++) {
        const lo = min + i * binWidth;
        const hi = lo + binWidth;
        labels.push(`${lo.toFixed(1)}–${hi.toFixed(1)}`);
    }

    values.forEach(v => {
        let idx = Math.floor((v - min) / binWidth);
        if (idx >= numBins) idx = numBins - 1;
        counts[idx]++;
    });

    return { labels, counts };
}

// ═══════════════════════════════════════════════════════════════════════════
// K-MEANS TAB
// ═══════════════════════════════════════════════════════════════════════════
async function loadKMeans() {
    const kSlider = document.getElementById('kmeansK');
    const kValue = document.getElementById('kmeansKValue');
    kSlider.addEventListener('input', () => kValue.textContent = kSlider.value);

    document.getElementById('runKmeans').addEventListener('click', runKMeans);

    // Initial run
    runKMeans();

    // Load elbow chart
    const elbow = await fetchJSON('/api/elbow');
    destroyChart('elbowChart');
    charts['elbowChart'] = new Chart(document.getElementById('elbowChart'), {
        type: 'line',
        data: {
            labels: elbow.k_values,
            datasets: [
                {
                    label: 'Inertia (WCSS)',
                    data: elbow.inertias,
                    borderColor: COLORS.cyan.border,
                    backgroundColor: COLORS.cyan.bg,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    yAxisID: 'y',
                },
                {
                    label: 'Silhouette Score',
                    data: elbow.silhouette_scores,
                    borderColor: COLORS.amber.border,
                    backgroundColor: COLORS.amber.bg,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y:  { type: 'linear', position: 'left',  grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Inertia' } },
                y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Silhouette' } },
                x:  { grid: { display: false }, title: { display: true, text: 'K' } }
            }
        }
    });
}

async function runKMeans() {
    const k = document.getElementById('kmeansK').value;
    const data = await fetchJSON(`/api/kmeans?k=${k}`);

    renderMetrics('kmeansMetrics', [
        { value: data.n_clusters, label: 'Clusters' },
        { value: data.silhouette_score, label: 'Silhouette Score' },
        { value: data.inertia, label: 'Inertia (WCSS)' },
    ]);

    // Scatter plot
    destroyChart('kmeansScatter');
    const datasets = [];
    for (let i = 0; i < data.n_clusters; i++) {
        const points = [];
        for (let j = 0; j < data.labels.length; j++) {
            if (data.labels[j] === i) {
                points.push({ x: data.pca_x[j], y: data.pca_y[j] });
            }
        }
        datasets.push({
            label: `Cluster ${i}`,
            data: points,
            backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length].bg,
            borderColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length].border,
            borderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 6,
        });
    }

    charts['kmeansScatter'] = new Chart(document.getElementById('kmeansScatter'), {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `PC1: ${ctx.parsed.x.toFixed(2)}, PC2: ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Principal Component 1' } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Principal Component 2' } }
            }
        }
    });

    // Cluster bar chart
    destroyChart('kmeansBarChart');
    charts['kmeansBarChart'] = new Chart(document.getElementById('kmeansBarChart'), {
        type: 'bar',
        data: {
            labels: data.cluster_stats.map(c => `Cluster ${c.cluster}`),
            datasets: [{
                label: 'Members',
                data: data.cluster_stats.map(c => c.count),
                backgroundColor: data.cluster_stats.map((_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length].bg),
                borderColor: data.cluster_stats.map((_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length].border),
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Count' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// DBSCAN TAB
// ═══════════════════════════════════════════════════════════════════════════
async function loadDBSCAN() {
    const epsSlider = document.getElementById('dbscanEps');
    const epsVal = document.getElementById('dbscanEpsValue');
    epsSlider.addEventListener('input', () => epsVal.textContent = epsSlider.value);

    const minSlider = document.getElementById('dbscanMinSamples');
    const minVal = document.getElementById('dbscanMinValue');
    minSlider.addEventListener('input', () => minVal.textContent = minSlider.value);

    document.getElementById('runDbscan').addEventListener('click', runDBSCAN);
    runDBSCAN();
}

async function runDBSCAN() {
    const btn = document.getElementById('runDbscan');
    const eps = document.getElementById('dbscanEps').value;
    const minSamples = document.getElementById('dbscanMinSamples').value;

    // Show loading state
    btn.disabled = true;
    btn.textContent = '⏳ Running...';
    document.getElementById('dbscanMetrics').innerHTML =
        '<div class="loading-spinner"><div class="spinner"></div><p>Running DBSCAN...</p></div>';

    try {
        const data = await fetchJSON(`/api/dbscan?eps=${eps}&min_samples=${minSamples}`);

        renderMetrics('dbscanMetrics', [
            { value: data.n_clusters, label: 'Clusters Found' },
            { value: data.n_noise, label: 'Noise Points' },
            { value: data.silhouette_score >= 0 ? data.silhouette_score : 'N/A', label: 'Silhouette Score' },
        ]);

        // Scatter plot
        destroyChart('dbscanScatter');
        const uniqueLabels = [...new Set(data.labels)].sort((a, b) => a - b);
        const datasets = uniqueLabels.map(label => {
            const points = [];
            for (let j = 0; j < data.labels.length; j++) {
                if (data.labels[j] === label) {
                    points.push({ x: data.pca_x[j], y: data.pca_y[j] });
                }
            }
            const color = label === -1 ? NOISE_COLOR : CLUSTER_COLORS[(label) % CLUSTER_COLORS.length];
            return {
                label: label === -1 ? 'Noise' : `Cluster ${label}`,
                data: points,
                backgroundColor: color.bg,
                borderColor: color.border,
                borderWidth: 1,
                pointRadius: label === -1 ? 2 : 3,
                pointHoverRadius: 6,
            };
        });

        charts['dbscanScatter'] = new Chart(document.getElementById('dbscanScatter'), {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Principal Component 1' } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Principal Component 2' } }
                }
            }
        });

        // Bar chart
        destroyChart('dbscanBarChart');
        charts['dbscanBarChart'] = new Chart(document.getElementById('dbscanBarChart'), {
            type: 'bar',
            data: {
                labels: data.cluster_stats.map(c => c.label),
                datasets: [{
                    label: 'Members',
                    data: data.cluster_stats.map(c => c.count),
                    backgroundColor: data.cluster_stats.map(c =>
                        c.cluster === -1 ? NOISE_COLOR.bg : CLUSTER_COLORS[c.cluster % CLUSTER_COLORS.length].bg
                    ),
                    borderColor: data.cluster_stats.map(c =>
                        c.cluster === -1 ? NOISE_COLOR.border : CLUSTER_COLORS[c.cluster % CLUSTER_COLORS.length].border
                    ),
                    borderWidth: 2,
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Count' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Run DBSCAN';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PCA TAB
// ═══════════════════════════════════════════════════════════════════════════
async function loadPCA() {
    const data = await fetchJSON('/api/pca?n_components=2');

    const totalVar = data.explained_variance_ratio.reduce((a, b) => a + b, 0);
    renderMetrics('pcaMetrics', [
        { value: data.n_components, label: 'Components Used' },
        { value: `${(data.explained_variance_ratio[0] * 100).toFixed(1)}%`, label: 'PC1 Variance' },
        { value: `${(data.explained_variance_ratio[1] * 100).toFixed(1)}%`, label: 'PC2 Variance' },
        { value: `${(totalVar * 100).toFixed(1)}%`, label: 'Total Variance (2D)' },
    ]);

    // PCA Scatter
    destroyChart('pcaScatter');
    const uniqueLabels = [...new Set(data.cluster_labels)];
    const datasets = uniqueLabels.map(label => {
        const points = [];
        for (let j = 0; j < data.cluster_labels.length; j++) {
            if (data.cluster_labels[j] === label) {
                points.push({ x: data.pc1[j], y: data.pc2[j] });
            }
        }
        return {
            label: `Group ${label}`,
            data: points,
            backgroundColor: CLUSTER_COLORS[label % CLUSTER_COLORS.length].bg,
            borderColor: CLUSTER_COLORS[label % CLUSTER_COLORS.length].border,
            borderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 6,
        };
    });

    charts['pcaScatter'] = new Chart(document.getElementById('pcaScatter'), {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: `PC1 (${(data.explained_variance_ratio[0]*100).toFixed(1)}%)` } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: `PC2 (${(data.explained_variance_ratio[1]*100).toFixed(1)}%)` } }
            }
        }
    });

    // Variance bar chart
    destroyChart('pcaVarianceChart');
    const topN = Math.min(10, data.all_variance_ratios.length);
    charts['pcaVarianceChart'] = new Chart(document.getElementById('pcaVarianceChart'), {
        type: 'bar',
        data: {
            labels: Array.from({ length: topN }, (_, i) => `PC${i + 1}`),
            datasets: [{
                label: 'Explained Variance Ratio',
                data: data.all_variance_ratios.slice(0, topN).map(v => (v * 100).toFixed(2)),
                backgroundColor: Array.from({ length: topN }, (_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length].bg),
                borderColor: Array.from({ length: topN }, (_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length].border),
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Variance (%)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Cumulative variance line chart
    destroyChart('pcaCumulativeChart');
    charts['pcaCumulativeChart'] = new Chart(document.getElementById('pcaCumulativeChart'), {
        type: 'line',
        data: {
            labels: Array.from({ length: data.cumulative_variance.length }, (_, i) => `PC${i + 1}`),
            datasets: [{
                label: 'Cumulative Explained Variance',
                data: data.cumulative_variance.map(v => (v * 100).toFixed(2)),
                borderColor: COLORS.cyan.border,
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                annotation: {}
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Cumulative Variance (%)' }, max: 100 },
                x: { grid: { display: false }, title: { display: true, text: 'Principal Component' } }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// RANDOM FOREST TAB
// ═══════════════════════════════════════════════════════════════════════════
async function loadRF() {
    const data = await fetchJSON('/api/random-forest');

    renderMetrics('rfMetrics', [
        { value: `${(data.accuracy * 100).toFixed(1)}%`, label: 'Accuracy' },
        { value: data.train_size, label: 'Train Samples' },
        { value: data.test_size, label: 'Test Samples' },
        { value: data.feature_importance.length, label: 'Features Used' },
    ]);

    // Feature importance (top 10)
    destroyChart('rfImportanceChart');
    const top10 = data.feature_importance.slice(0, 10);
    charts['rfImportanceChart'] = new Chart(document.getElementById('rfImportanceChart'), {
        type: 'bar',
        data: {
            labels: top10.map(f => f.feature),
            datasets: [{
                label: 'Importance',
                data: top10.map(f => f.importance),
                backgroundColor: top10.map((_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length].bg),
                borderColor: top10.map((_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length].border),
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Importance' } },
                y: { grid: { display: false } }
            }
        }
    });

    // Confusion matrix
    renderConfusionMatrix(data.confusion_matrix, data.class_names);

    // Per-class metrics
    destroyChart('rfClassMetrics');
    const classNames = data.class_names;
    const precisions = classNames.map(c => data.classification_report[c]?.precision || 0);
    const recalls = classNames.map(c => data.classification_report[c]?.recall || 0);
    const f1s = classNames.map(c => data.classification_report[c]?.['f1-score'] || 0);

    charts['rfClassMetrics'] = new Chart(document.getElementById('rfClassMetrics'), {
        type: 'bar',
        data: {
            labels: classNames,
            datasets: [
                {
                    label: 'Precision',
                    data: precisions,
                    backgroundColor: COLORS.cyan.bg,
                    borderColor: COLORS.cyan.border,
                    borderWidth: 2,
                    borderRadius: 4,
                },
                {
                    label: 'Recall',
                    data: recalls,
                    backgroundColor: COLORS.purple.bg,
                    borderColor: COLORS.purple.border,
                    borderWidth: 2,
                    borderRadius: 4,
                },
                {
                    label: 'F1-Score',
                    data: f1s,
                    backgroundColor: COLORS.amber.bg,
                    borderColor: COLORS.amber.border,
                    borderWidth: 2,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Score' }, max: 1 },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderConfusionMatrix(matrix, classNames) {
    const container = document.getElementById('confusionMatrixContainer');
    const maxVal = Math.max(...matrix.flat());

    let html = '<div class="confusion-matrix">';
    // Header row
    html += '<div class="cm-header"></div>';
    classNames.forEach(name => {
        html += `<div class="cm-header">Pred<br>${name}</div>`;
    });

    // Data rows
    matrix.forEach((row, i) => {
        html += `<div class="cm-label">Actual<br>${classNames[i]}</div>`;
        row.forEach((val, j) => {
            const intensity = maxVal > 0 ? val / maxVal : 0;
            const isDiag = i === j;
            const color = isDiag
                ? `rgba(34, 197, 94, ${0.15 + intensity * 0.6})`
                : `rgba(239, 68, 68, ${0.05 + intensity * 0.4})`;
            html += `<div class="cm-cell" style="background:${color}">${val}</div>`;
        });
    });

    html += '</div>';
    container.innerHTML = html;
}


