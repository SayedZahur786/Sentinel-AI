import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/AppShell"
import { LoadingState } from "@/components/StateViews"

const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Analyzer = lazy(() => import("@/pages/Analyzer"))
const ContextLab = lazy(() => import("@/pages/ContextLab"))
const Reviews = lazy(() => import("@/pages/Reviews"))
const Policies = lazy(() => import("@/pages/Policies"))
const Evaluation = lazy(() => import("@/pages/Evaluation"))
const Audit = lazy(() => import("@/pages/Audit"))

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading workspace" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="analyzer" element={<Analyzer />} />
          <Route path="context-lab" element={<ContextLab />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="policies" element={<Policies />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="audit" element={<Audit />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
