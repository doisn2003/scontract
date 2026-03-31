import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import {
  HiOutlinePlay,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PageWrapper from '../components/Layout/PageWrapper';
import api from '../services/api';
import { getEthersTemplate, getViemTemplate } from '../utils/testTemplates';
import type { ApiResponse, Project } from '../types';
import './TestPage.css';

type TestLibrary = 'viem' | 'ethers';

interface TestCase {
  title: string;
  status: 'passing' | 'failing';
  duration?: number;
  error?: string;
}

interface TestResult {
  success: boolean;
  summary?: {
    total: number;
    passing: number;
    failing: number;
    duration: number;
  };
  tests?: TestCase[];
  rawOutput?: string;
  error?: string;
}

export default function TestPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [library, setLibrary] = useState<TestLibrary>('viem');
  const [testCode, setTestCode] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);

  // Fetch project
  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`);
      if (data.success && data.data) {
        setProject(data.data);
        // Auto-fill template
        const contractName = data.data.name || 'MyContract';
        setTestCode(getViemTemplate(contractName));
      }
    } catch {
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Library switch → update template
  const handleLibraryChange = (lib: TestLibrary) => {
    setLibrary(lib);
    const contractName = project?.name || 'MyContract';
    const template = lib === 'viem'
      ? getViemTemplate(contractName)
      : getEthersTemplate(contractName);

    // Only replace if user hasn't modified much
    if (!testCode || testCode.includes('// Add more tests below...')) {
      setTestCode(template);
    }
  };

  // Run tests
  const handleRunTests = async () => {
    if (!id || !testCode.trim()) {
      toast.error('Please write test code first');
      return;
    }

    setIsRunning(true);
    setResult(null);
    setShowRawOutput(false);

    try {
      const { data } = await api.post<ApiResponse<TestResult>>(`/tests/${id}`, {
        testCode,
        library,
      });

      if (data.success && data.data) {
        setResult(data.data);
        if (data.data.success) {
          toast.success('All tests passed! 🎉');
        } else if (data.data.summary && data.data.summary.failing > 0) {
          toast.error(`${data.data.summary.failing} test(s) failed`);
        } else if (data.data.error) {
          toast.error('Test execution error');
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Test execution failed';
      setResult({ success: false, error: msg });
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <PageWrapper title="Unit Tests">
        <div className="skeleton" style={{ height: 400 }} />
      </PageWrapper>
    );
  }

  if (!project) {
    return (
      <PageWrapper title="Not Found">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <h3>Project not found</h3>
          <Link to="/projects" className="btn btn-primary" style={{ marginTop: 16 }}>
            Back to Projects
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title={`${t('pages.test.title')}: ${project.name}`}
      subtitle={t('pages.test.subtitle')}
    >
      <div className="test-page">
        {/* Top Bar */}
        <div className="test-toolbar">
          <div className="test-toolbar-left">
            <div className="library-switch">
              {(['viem', 'ethers'] as TestLibrary[]).map(lib => (
                <button
                  key={lib}
                  className={`library-btn ${library === lib ? 'active' : ''}`}
                  onClick={() => handleLibraryChange(lib)}
                >
                  {lib === 'viem' ? '⚡ Viem' : '🔧 Ethers.js'}
                </button>
              ))}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const contractName = project.name || 'MyContract';
                setTestCode(library === 'viem' ? getViemTemplate(contractName) : getEthersTemplate(contractName));
                toast.success('Template reset');
              }}
            >
              <HiOutlineArrowPath /> Reset Template
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRunTests}
            disabled={isRunning || !testCode.trim()}
          >
            {isRunning ? (
              <><span className="spinner" style={{ width: 14, height: 14 }} /> Running... (10-30s)</>
            ) : (
              <><HiOutlinePlay /> Run Tests</>
            )}
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="test-panels">
          {/* Left: Editor */}
          <div className="test-editor-panel">
            <div className="panel-header">
              <span>📝 Test Code</span>
              <span className="panel-hint">{testCode.split('\n').length} lines</span>
            </div>
            <textarea
              className="test-editor"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              spellCheck={false}
              placeholder="// Write your test code here..."
            />
          </div>

          {/* Right: Results */}
          <div className="test-result-panel">
            <div className="panel-header">
              <span>📊 Results</span>
            </div>

            {isRunning ? (
              <div className="test-running">
                <div className="spinner" style={{ width: 32, height: 32 }} />
                <p>Running tests in Docker sandbox...</p>
                <p className="test-running-hint">This may take 10-30 seconds</p>
              </div>
            ) : !result ? (
              <div className="test-empty">
                <HiOutlinePlay style={{ fontSize: '2rem', color: 'var(--color-text-muted)' }} />
                <p>Click "Run Tests" to execute</p>
              </div>
            ) : (
              <div className="test-results">
                {/* Summary Bar */}
                {result.summary && (
                  <div className={`test-summary ${result.success ? 'success' : 'fail'}`}>
                    <div className="test-summary-item">
                      <HiOutlineCheckCircle className="icon-pass" />
                      <span>{result.summary.passing} passing</span>
                    </div>
                    <div className="test-summary-item">
                      <HiOutlineXCircle className="icon-fail" />
                      <span>{result.summary.failing} failing</span>
                    </div>
                    <div className="test-summary-item">
                      <HiOutlineClock />
                      <span>{result.summary.duration}ms</span>
                    </div>
                  </div>
                )}

                {/* Error (no tests) */}
                {result.error && !result.tests?.length && (
                  <div className="test-error-box">
                    <HiOutlineExclamationTriangle />
                    <pre>{result.error}</pre>
                  </div>
                )}

                {/* Individual Test Cases */}
                {result.tests && result.tests.length > 0 && (
                  <div className="test-cases">
                    {result.tests.map((tc, i) => (
                      <div key={i} className={`test-case ${tc.status}`}>
                        <div className="test-case-header">
                          {tc.status === 'passing' ? (
                            <HiOutlineCheckCircle className="icon-pass" />
                          ) : (
                            <HiOutlineXCircle className="icon-fail" />
                          )}
                          <span className="test-case-title">{tc.title}</span>
                          {tc.duration !== undefined && (
                            <span className="test-case-duration">{tc.duration}ms</span>
                          )}
                        </div>
                        {tc.error && (
                          <pre className="test-case-error">{tc.error}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw Output Toggle */}
                {result.rawOutput && (
                  <div className="test-raw">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowRawOutput(!showRawOutput)}
                    >
                      {showRawOutput ? 'Hide' : 'Show'} Raw Output
                    </button>
                    {showRawOutput && (
                      <pre className="test-raw-output">{result.rawOutput}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
