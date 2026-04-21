import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Card from '../../components/Card';
import { Plus, Edit, Trash2, User, Mail, Phone, Calendar, Shield, Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canManageEmployees, canAddEmployee, canEditEmployee, canDeleteEmployee } from '../../config/permissions';
import { isOptionalPhoneValid } from '../../utils/phoneValidation';

const Employees = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: '',
    phone: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      console.log('Current user role:', user?.role);
      const response = await axios.get('/api/hr/employees');
      console.log('Fetched employees:', response.data);
      setEmployees(response.data.data);
    } catch (error) {
      console.error('Fetch employees error:', error);
      console.error('Error details:', error.response?.data);
      toast.error(t('hr.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOptionalPhoneValid(formData.phone)) {
      toast.error(t('validation.phoneInvalid'));
      return;
    }
    try {
      if (editingEmployee) {
        // For editing, update employee
        const submitData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
          holidays: formData.holidays || 0,
          phone: formData.phone || ''
        };
        
        // Only include password if it's provided (not empty)
        if (formData.password && formData.password.trim() !== '') {
          submitData.password = formData.password;
        }
        
        await axios.put(`/api/hr/employees/${editingEmployee._id}`, submitData);
        toast.success(t('messages.updateSuccess'));
      } else {
        // For new employees, create user
        console.log('Creating employee with data:', formData);
        console.log('Form validation - name:', formData.name);
        console.log('Form validation - email:', formData.email);
        console.log('Form validation - password:', formData.password);
        console.log('Form validation - role:', formData.role);
        console.log('Form validation - department:', formData.department);
        console.log('Form validation - holidays:', formData.holidays);
        
        const response = await axios.post('/api/hr/employees', {
          ...formData,
          holidays: formData.holidays || 0,
          phone: formData.phone || ''
        });
        console.log('Employee created:', response.data);
        toast.success(t('messages.createSuccess'));
      }
      setShowModal(false);
      setEditingEmployee(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        department: '',
        holidays: '',
        phone: ''
      });
      // Force refresh the employees list
      await fetchEmployees();
    } catch (error) {
      console.error('Employee save error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      if (error.response?.status === 400) {
        // Validation errors
        const errorData = error.response.data;
        let errorMessage = t('hr.errors.validationFailed');
        
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          // Show first validation error
          const firstError = errorData.errors[0];
          errorMessage = firstError.msg || firstError.message || t('hr.errors.validationError');
        }
        
        toast.error(errorMessage);
      } else if (error.response?.status === 500) {
        // Server errors
        const errorMessage = error.response?.data?.message || error.response?.data?.error || t('hr.errors.serverError');
        toast.error(errorMessage);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        // Authorization errors
        toast.error(t('hr.errors.noPermission'));
      } else {
        // Other errors
        const errorMessage = error.response?.data?.message || error.message || t('hr.errors.saveFailed');
        toast.error(errorMessage);
      }
    }
  };

  const handleEdit = (employee) => {
    if (!employee.user) {
      toast.error(t('hr.errors.cannotEdit'));
      return;
    }
    setEditingEmployee(employee);
    setFormData({
      name: employee.user.name || '',
      email: employee.user.email || '',
      password: '', // Don't show password for editing
      role: employee.user.role || 'employee',
      department: employee.department || '',
      holidays: employee.holidays || '',
      phone: employee.personalInfo?.phone || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('hr.deleteConfirm'))) {
      try {
        await axios.delete(`/api/hr/employees/${id}`);
        toast.success(t('messages.deleteSuccess'));
        fetchEmployees();
      } catch (error) {
        console.error('Delete error:', error);
        const message = error.response?.data?.message || error.message || t('hr.errors.deleteFailed');
        toast.error(message);
      }
    }
  };

  // Check if user can manage employees
  const canManage = canManageEmployees(user);
  const canAdd = canAddEmployee(user);
  const canEdit = canEditEmployee(user);
  const canDelete = canDeleteEmployee(user);
  console.log('User data:', user);
  console.log('Can manage employees:', canManage);
  console.log('Can add employee:', canAdd);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('hr.employees.title')}</h1>
            {canManage && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400">
                <Shield className="h-3 w-3 mr-1" />
                {t('hr.employees.adminOnly')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {canAdd 
              ? t('hr.employees.descriptionManage')
              : t('hr.employees.descriptionView')
            }
          </p>
        </div>
        {canAdd ? (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </button>
        ) : (
          <button
            onClick={() => {
              toast.error(t('hr.errors.addRestricted'));
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 cursor-not-allowed transition-colors"
          >
            <Shield className="h-4 w-4 mr-2" />
            {t('hr.employees.addEmployeeRestricted')}
          </button>
        )}
      </div>

      {/* Search Bar */}
      <Card paddingSize="sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('hr.employees.searchPlaceholder')}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
      </Card>

      {/* Employees Table */}
      <Card padding={false} className="overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
          {employees
            .filter((employee) => employee.user) // Filter out employees without user data
            .filter((employee) => {
              if (!searchQuery) return true;
              const name = employee.user?.name || '';
              return name.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .map((employee) => (
            <li key={employee._id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {employee.user?.name || t('common.unknown')}
                      </p>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400">
                        {employee.employeeId}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>{employee.position}</span>
                      <span className="mx-2">•</span>
                      <span>{employee.department}</span>
                      {employee.holidays !== undefined && employee.holidays > 0 && (
                        <>
                          <span className="mx-2">•</span>
                          <span>{employee.holidays} {t('hr.employees.holidaysCount')}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Mail className="h-4 w-4 mr-1" />
                      <span>{employee.user?.email || t('hr.employees.noEmail')}</span>
                      {employee.personalInfo?.phone && (
                        <>
                          <span className="mx-2">•</span>
                          <Phone className="h-4 w-4 mr-1" />
                          <span>{employee.personalInfo.phone}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{t('hr.employees.hired')}: {new Date(employee.hireDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {canEdit ? (
                    <button
                      onClick={() => handleEdit(employee)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        toast.error(t('hr.errors.editRestricted'));
                      }}
                      className="cursor-not-allowed text-gray-400 dark:text-gray-500"
                      disabled
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete ? (
                    <button
                      onClick={() => handleDelete(employee._id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        toast.error(t('hr.errors.deleteRestricted'));
                      }}
                      className="cursor-not-allowed text-gray-400 dark:text-gray-500"
                      disabled
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingEmployee ? t('hr.employees.editEmployee') : t('hr.employees.addEmployee')}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingEmployee(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {!canManage && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30 rounded-md">
                <div className="flex">
                  <Shield className="h-5 w-5 text-yellow-400 dark:text-yellow-500" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{t('hr.employees.adminAccessRequired')}</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      {t('hr.employees.adminAccessMessage')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('hr.employees.fullName')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('common.email')}
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>
              {!editingEmployee && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('auth.password')}
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('hr.employees.role')}
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="employee">{t('hr.employees.roleEmployee')}</option>
                  <option value="manager">{t('hr.employees.roleManager')}</option>
                  <option value="admin">{t('hr.employees.roleAdmin')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('hr.employees.department')}
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
                  <option value="">{t('hr.employees.selectDepartment')}</option>
                  <option value="HR">{t('navigation.hr')}</option>
                  <option value="Manufacturing">{t('navigation.manufacturing')}</option>
                  <option value="SCM">{t('navigation.scm')}</option>
                  <option value="CRM">{t('navigation.crm')}</option>
                  <option value="Sales">{t('navigation.sales')}</option>
                  <option value="Inventory">{t('navigation.inventory')}</option>
                  <option value="Purchasing">{t('navigation.purchasing')}</option>
                  <option value="Finance">{t('navigation.finance')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('hr.employees.phoneNumber')}
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('common.optional')}: {t('validation.phoneHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('hr.employees.holidays')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.holidays}
                  onChange={(e) => setFormData({ ...formData, holidays: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                {canManage ? (
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
                  >
                    {editingEmployee ? t('common.update') : t('common.create')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      toast.error(t('hr.errors.adminOnly'));
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 cursor-not-allowed transition-colors"
                    disabled
                  >
                    {editingEmployee ? t('hr.employees.updateAdminOnly') : t('hr.employees.createAdminOnly')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;