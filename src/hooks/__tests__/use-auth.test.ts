import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import * as actions from "@/actions";
import * as anonTracker from "@/lib/anon-work-tracker";
import * as getProjectsModule from "@/actions/get-projects";
import * as createProjectModule from "@/actions/create-project";
import type { AuthResult } from "@/actions";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

const mockSignIn = vi.mocked(actions.signIn);
const mockSignUp = vi.mocked(actions.signUp);
const mockGetAnonWorkData = vi.mocked(anonTracker.getAnonWorkData);
const mockClearAnonWork = vi.mocked(anonTracker.clearAnonWork);
const mockGetProjects = vi.mocked(getProjectsModule.getProjects);
const mockCreateProject = vi.mocked(createProjectModule.createProject);

const SUCCESS: AuthResult = { success: true };
const FAILURE: AuthResult = { success: false, error: "Invalid credentials" };

const ANON_MESSAGES = [{ id: "1", role: "user", content: "Hello" }];
const ANON_FS_DATA = { "/App.jsx": { type: "file", content: "export default () => <div/>" } };
const ANON_WORK = { messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA };

const PROJECT = { id: "proj-1", name: "Saved Project", createdAt: new Date(), updatedAt: new Date() } as any;
const NEW_PROJECT = { id: "new-proj-99", name: "New Design #42", createdAt: new Date(), updatedAt: new Date() } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue(NEW_PROJECT);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// signIn — loading state
// ---------------------------------------------------------------------------

describe("signIn — isLoading", () => {
  test("sets isLoading to true while the action is in-flight", async () => {
    let resolveAction!: (v: AuthResult) => void;
    const deferred = new Promise<AuthResult>((res) => { resolveAction = res; });
    mockSignIn.mockReturnValueOnce(deferred);

    const { result } = renderHook(() => useAuth());

    // Kick off without awaiting
    act(() => { result.current.signIn("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(true);

    // Resolve and let React flush
    await act(async () => { resolveAction(SUCCESS); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false after success", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false after failure result", async () => {
    mockSignIn.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when the action throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw").catch(() => {});
    });
    expect(result.current.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signIn — post-sign-in routing: anon work with messages
// ---------------------------------------------------------------------------

describe("signIn — anon work with messages", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(ANON_WORK);
    mockCreateProject.mockResolvedValue(PROJECT);
  });

  test("creates a project from anon work", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockCreateProject).toHaveBeenCalledWith({
      name: expect.stringContaining("Design from"),
      messages: ANON_MESSAGES,
      data: ANON_FS_DATA,
    });
  });

  test("clears anon work after creating the project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockClearAnonWork).toHaveBeenCalledOnce();
  });

  test("navigates to the new project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockPush).toHaveBeenCalledWith(`/${PROJECT.id}`);
  });

  test("does not call getProjects when anon work exists", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// signIn — post-sign-in routing: anon work with empty messages
// ---------------------------------------------------------------------------

describe("signIn — anon work with empty messages", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
  });

  test("falls through to check existing projects", async () => {
    mockGetProjects.mockResolvedValue([PROJECT]);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/${PROJECT.id}`);
  });

  test("does not create a project from empty anon work", async () => {
    mockGetProjects.mockResolvedValue([PROJECT]);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// signIn — post-sign-in routing: no anon work, existing projects
// ---------------------------------------------------------------------------

describe("signIn — no anon work, existing projects", () => {
  const projects = [PROJECT, { ...PROJECT, id: "proj-2" }];

  beforeEach(() => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue(projects);
  });

  test("navigates to the most recent project (index 0)", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockPush).toHaveBeenCalledWith(`/${projects[0].id}`);
  });

  test("does not create a new project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// signIn — post-sign-in routing: no anon work, no existing projects
// ---------------------------------------------------------------------------

describe("signIn — no anon work, no projects", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue(NEW_PROJECT);
  });

  test("creates a new empty project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockCreateProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^New Design #\d+$/),
      messages: [],
      data: {},
    });
  });

  test("navigates to the newly created project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
  });
});

// ---------------------------------------------------------------------------
// signIn — failure / error paths
// ---------------------------------------------------------------------------

describe("signIn — failure cases", () => {
  test("returns the failure result without calling any routing logic", async () => {
    mockSignIn.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    let returned: AuthResult | undefined;
    await act(async () => { returned = await result.current.signIn("a@b.com", "pw"); });
    expect(returned).toEqual(FAILURE);
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("forwards the exact AuthResult on failure", async () => {
    const customFailure: AuthResult = { success: false, error: "Email not found" };
    mockSignIn.mockResolvedValue(customFailure);
    const { result } = renderHook(() => useAuth());
    let returned: AuthResult | undefined;
    await act(async () => { returned = await result.current.signIn("a@b.com", "pw"); });
    expect(returned).toEqual(customFailure);
  });

  test("propagates an exception thrown by the action", async () => {
    mockSignIn.mockRejectedValue(new Error("server error"));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await expect(result.current.signIn("a@b.com", "pw")).rejects.toThrow("server error");
    });
  });

  test("calls signIn with the provided email and password", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([PROJECT]);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("user@example.com", "secret123"); });
    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret123");
  });
});

// ---------------------------------------------------------------------------
// signUp — mirrors signIn routing logic
// ---------------------------------------------------------------------------

describe("signUp — loading state", () => {
  test("sets isLoading to true while the action is in-flight", async () => {
    let resolveAction!: (v: AuthResult) => void;
    const deferred = new Promise<AuthResult>((res) => { resolveAction = res; });
    mockSignUp.mockReturnValueOnce(deferred);

    const { result } = renderHook(() => useAuth());
    act(() => { result.current.signUp("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveAction(SUCCESS); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when the action throws", async () => {
    mockSignUp.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("a@b.com", "pw").catch(() => {});
    });
    expect(result.current.isLoading).toBe(false);
  });
});

describe("signUp — anon work with messages", () => {
  beforeEach(() => {
    mockSignUp.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(ANON_WORK);
    mockCreateProject.mockResolvedValue(PROJECT);
  });

  test("creates a project from anon work and navigates to it", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@b.com", "pw"); });
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: ANON_MESSAGES, data: ANON_FS_DATA })
    );
    expect(mockClearAnonWork).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith(`/${PROJECT.id}`);
  });
});

describe("signUp — no anon work, existing projects", () => {
  beforeEach(() => {
    mockSignUp.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([PROJECT]);
  });

  test("navigates to the most recent project", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@b.com", "pw"); });
    expect(mockPush).toHaveBeenCalledWith(`/${PROJECT.id}`);
  });
});

describe("signUp — no anon work, no projects", () => {
  beforeEach(() => {
    mockSignUp.mockResolvedValue(SUCCESS);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue(NEW_PROJECT);
  });

  test("creates a new empty project and navigates to it", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("a@b.com", "pw"); });
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
  });
});

describe("signUp — failure cases", () => {
  test("returns failure result without routing", async () => {
    mockSignUp.mockResolvedValue(FAILURE);
    const { result } = renderHook(() => useAuth());
    let returned: AuthResult | undefined;
    await act(async () => { returned = await result.current.signUp("a@b.com", "pw"); });
    expect(returned).toEqual(FAILURE);
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("calls signUp with the provided email and password", async () => {
    mockSignUp.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([PROJECT]);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@example.com", "newpass99"); });
    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "newpass99");
  });

  test("propagates an exception thrown by the action", async () => {
    mockSignUp.mockRejectedValue(new Error("db error"));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await expect(result.current.signUp("a@b.com", "pw")).rejects.toThrow("db error");
    });
  });
});

// ---------------------------------------------------------------------------
// signIn and signUp do not share loading state
// ---------------------------------------------------------------------------

describe("concurrent state isolation", () => {
  test("signIn and signUp maintain independent isLoading (sequential calls reset correctly)", async () => {
    mockSignIn.mockResolvedValue(SUCCESS);
    mockSignUp.mockResolvedValue(SUCCESS);
    mockGetProjects.mockResolvedValue([PROJECT]);

    const { result } = renderHook(() => useAuth());

    await act(async () => { await result.current.signIn("a@b.com", "pw"); });
    expect(result.current.isLoading).toBe(false);

    await act(async () => { await result.current.signUp("b@c.com", "pw"); });
    expect(result.current.isLoading).toBe(false);
  });
});
