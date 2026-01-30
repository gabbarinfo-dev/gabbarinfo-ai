import { useState, useEffect } from "react";

/**
 * BoostModal - A self-contained component for boosting a Facebook Page post.
 * Steps: 1. Select Page, 2. Select Post, 3. Boost Settings, 4. Final Create
 */
export default function BoostModal({ isOpen, onClose }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Data
    const [pages, setPages] = useState([]);
    const [posts, setPosts] = useState([]);

    // Selections
    const [selectedPageId, setSelectedPageId] = useState("");
    const [selectedPostId, setSelectedPostId] = useState("");
    const [budget, setBudget] = useState(500);
    const [duration, setDuration] = useState(7);

    // Result
    const [result, setResult] = useState(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setError(null);
            setResult(null);
            setSelectedPageId("");
            setSelectedPostId("");
            setBudget(500);
            setDuration(7);
            fetchPages();
        }
    }, [isOpen]);

    async function fetchPages() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/meta/boost/list-pages");
            const data = await res.json();
            if (data.ok) {
                setPages(data.pages || []);
                if (data.pages?.length === 1) {
                    setSelectedPageId(data.pages[0].id);
                }
            } else {
                setError(data.message || "Failed to load pages.");
            }
        } catch (err) {
            setError("Network error loading pages.");
        } finally {
            setLoading(false);
        }
    }

    async function fetchPosts(pageId) {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/meta/boost/list-posts?page_id=${pageId}`);
            const data = await res.json();
            if (data.ok) {
                setPosts(data.posts || []);
            } else {
                setError(data.message || "Failed to load posts.");
            }
        } catch (err) {
            setError("Network error loading posts.");
        } finally {
            setLoading(false);
        }
    }

    const handleNextStep = () => {
        if (step === 1 && selectedPageId) {
            fetchPosts(selectedPageId);
            setStep(2);
        } else if (step === 2 && selectedPostId) {
            setStep(3);
        } else if (step === 3) {
            handleCreateBoost();
        }
    };

    const handleCreateBoost = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/meta/boost/create-boost", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    page_id: selectedPageId,
                    post_id: selectedPostId,
                    daily_budget: Number(budget),
                    duration: Number(duration),
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setResult(data);
                setStep(4);
            } else {
                setError(data.message || "Failed to create boost.");
            }
        } catch (err) {
            setError("Network error creating boost.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Boost a Facebook Page Post</h2>
                    <button onClick={onClose} style={styles.closeBtn}>×</button>
                </div>

                <div style={styles.progress}>
                    {[1, 2, 3, 4].map((s) => (
                        <div
                            key={s}
                            style={{
                                ...styles.dot,
                                background: step >= s ? "#1877F2" : "#ddd",
                            }}
                        />
                    ))}
                </div>

                <div style={styles.content}>
                    {error && <div style={styles.error}>{error}</div>}

                    {/* STEP 1: SELECT PAGE */}
                    {step === 1 && (
                        <div>
                            <p style={styles.label}>Select Facebook Page</p>
                            {loading ? (
                                <p>Loading pages...</p>
                            ) : pages.length > 0 ? (
                                <select
                                    value={selectedPageId}
                                    onChange={(e) => setSelectedPageId(e.target.value)}
                                    style={styles.select}
                                >
                                    <option value="">-- Select a Page --</option>
                                    {pages.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.id})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p>No pages found with management permissions.</p>
                            )}
                        </div>
                    )}

                    {/* STEP 2: SELECT POST */}
                    {step === 2 && (
                        <div>
                            <p style={styles.label}>Select Post to Boost</p>
                            {loading ? (
                                <p>Loading posts...</p>
                            ) : posts.length > 0 ? (
                                <div style={styles.postList}>
                                    {posts.map((post) => (
                                        <div
                                            key={post.id}
                                            onClick={() => setSelectedPostId(post.id)}
                                            style={{
                                                ...styles.postItem,
                                                borderColor: selectedPostId === post.id ? "#1877F2" : "#eee",
                                                backgroundColor: selectedPostId === post.id ? "#f0f7ff" : "#fff",
                                            }}
                                        >
                                            <div style={styles.postMeta}>
                                                {new Date(post.created_time).toLocaleDateString()}
                                            </div>
                                            <div style={styles.postText}>
                                                {post.message || post.story || "[No text]"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No eligible posts found for this page (max 3).</p>
                            )}
                        </div>
                    )}

                    {/* STEP 3: SETTINGS */}
                    {step === 3 && (
                        <div>
                            <p style={styles.label}>Daily Budget (INR)</p>
                            <input
                                type="number"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                style={styles.input}
                                min="100"
                            />
                            <p style={styles.label}>Duration (Days)</p>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                style={styles.input}
                                min="1"
                            />
                            <p style={styles.hint}>
                                Note: Targeting is set to India. The post will be boosted to a broad audience.
                            </p>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS */}
                    {step === 4 && result && (
                        <div style={styles.successBox}>
                            <div style={styles.successIcon}>✅</div>
                            <h3>Boost Created Successfully!</h3>
                            <p style={styles.successText}>
                                Your post is now being promoted. You can monitor its performance in your Meta Ads Manager.
                            </p>
                            <div style={styles.details}>
                                <div><strong>Ad ID:</strong> {result.ad_id}</div>
                                <div><strong>Status:</strong> {result.status}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div style={styles.footer}>
                    {step < 4 ? (
                        <>
                            <button
                                onClick={onClose}
                                style={styles.cancelBtn}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleNextStep}
                                style={styles.primaryBtn}
                                disabled={
                                    loading ||
                                    (step === 1 && !selectedPageId) ||
                                    (step === 2 && !selectedPostId) ||
                                    (step === 3 && (!budget || !duration))
                                }
                            >
                                {loading ? "Processing..." : step === 3 ? "Boost Now" : "Next"}
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} style={styles.primaryBtn}>
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        backdropFilter: "blur(2px)",
    },
    modal: {
        backgroundColor: "#fff",
        borderRadius: "12px",
        width: "90%",
        maxWidth: "480px",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
        animation: "modalFadeIn 0.3s ease-out",
    },
    header: {
        padding: "16px 20px",
        borderBottom: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        margin: 0,
        fontSize: "18px",
        fontWeight: "600",
        color: "#1c1e21",
    },
    closeBtn: {
        border: "none",
        background: "none",
        fontSize: "24px",
        cursor: "pointer",
        color: "#606770",
        lineHeight: 1,
    },
    progress: {
        display: "flex",
        justifyContent: "center",
        gap: "8px",
        padding: "12px 0",
        borderBottom: "1px solid #f0f2f5",
    },
    dot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        transition: "background 0.3s ease",
    },
    content: {
        padding: "20px",
        minHeight: "200px",
        maxHeight: "60vh",
        overflowY: "auto",
    },
    label: {
        fontSize: "14px",
        fontWeight: "600",
        marginBottom: "8px",
        color: "#4b4f56",
    },
    select: {
        width: "100%",
        padding: "10px",
        borderRadius: "6px",
        border: "1px solid #ddd",
        fontSize: "15px",
        marginBottom: "16px",
    },
    input: {
        width: "100%",
        padding: "10px",
        borderRadius: "6px",
        border: "1px solid #ddd",
        fontSize: "15px",
        marginBottom: "16px",
        boxSizing: "border-box",
    },
    postList: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    postItem: {
        padding: "12px",
        borderRadius: "8px",
        border: "2px solid #eee",
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    postMeta: {
        fontSize: "12px",
        color: "#8a8d91",
        marginBottom: "4px",
    },
    postText: {
        fontSize: "14px",
        color: "#1c1e21",
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
    },
    hint: {
        fontSize: "12px",
        color: "#606770",
        fontStyle: "italic",
        marginTop: "-8px",
        marginBottom: "16px",
    },
    error: {
        padding: "10px",
        backgroundColor: "#fde7e9",
        color: "#b00020",
        borderRadius: "6px",
        fontSize: "13px",
        marginBottom: "16px",
    },
    successBox: {
        textAlign: "center",
        padding: "10px 0",
    },
    successIcon: {
        fontSize: "48px",
        marginBottom: "12px",
    },
    successText: {
        color: "#606770",
        fontSize: "14px",
        lineHeight: "1.5",
    },
    details: {
        marginTop: "20px",
        padding: "12px",
        backgroundColor: "#f0f2f5",
        borderRadius: "8px",
        textAlign: "left",
        fontSize: "13px",
    },
    footer: {
        padding: "16px 20px",
        borderTop: "1px solid #eee",
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px",
    },
    primaryBtn: {
        padding: "9px 20px",
        backgroundColor: "#1877F2",
        color: "#fff",
        border: "none",
        borderRadius: "6px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "background 0.2s",
    },
    cancelBtn: {
        padding: "9px 20px",
        backgroundColor: "#fff",
        color: "#4b4f56",
        border: "1px solid #ddd",
        borderRadius: "6px",
        fontWeight: "600",
        cursor: "pointer",
    },
};
