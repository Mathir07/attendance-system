import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'

// Employee pages
import EmployeeLayout   from './components/EmployeeLayout'
import EmpDashboard     from './pages/employee/Dashboard'
import EmpAttendance    from './pages/employee/Attendance'
import EmpLeave         from './pages/employee/Leave'
import EmpPermission    from './pages/employee/Permission'
import EmpPayslips      from './pages/employee/Payslips'

// HR pages
import HRLayout         from './components/HRLayout'
import HRDashboard      from './pages/hr/Dashboard'
import HREmployees      from './pages/hr/Employees'
import HRAttendance     from './pages/hr/Attendance'
import HRLeave          from './pages/hr/Leave'
import HRPermission     from './pages/hr/Permission'
import HRPayslips       from './pages/hr/Payslips'
import HRHolidays       from './pages/hr/Holidays'
import HRAuditLogs      from './pages/hr/AuditLogs'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/"      element={<Navigate to="/login" replace />} />

        {/* Employee portal */}
        <Route element={<ProtectedRoute role="employee" />}>
          <Route element={<EmployeeLayout />}>
            <Route path="/employee/dashboard"  element={<EmpDashboard />} />
            <Route path="/employee/attendance" element={<EmpAttendance />} />
            <Route path="/employee/leave"      element={<EmpLeave />} />
            <Route path="/employee/permission" element={<EmpPermission />} />
            <Route path="/employee/payslips"   element={<EmpPayslips />} />
          </Route>
        </Route>

        {/* HR portal */}
        <Route element={<ProtectedRoute role="hr" />}>
          <Route element={<HRLayout />}>
            <Route path="/hr/dashboard"  element={<HRDashboard />} />
            <Route path="/hr/employees"  element={<HREmployees />} />
            <Route path="/hr/attendance" element={<HRAttendance />} />
            <Route path="/hr/leave"      element={<HRLeave />} />
            <Route path="/hr/permission" element={<HRPermission />} />
            <Route path="/hr/payslips"   element={<HRPayslips />} />
            <Route path="/hr/holidays"   element={<HRHolidays />} />
            <Route path="/hr/audit-logs" element={<HRAuditLogs />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
