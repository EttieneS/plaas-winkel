<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return ($this->user()?->hasPermission('users.create') ?? false)
            && ($this->user()?->hasPermission('roles.assign') ?? false);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'max:128', 'confirmed', Password::min(8)],
            'role_ids' => ['required', 'array', 'min:1', 'max:50'],
            'role_ids.*' => ['required', 'integer', 'distinct', 'exists:roles,id'],
            'permissions' => ['prohibited'],
            'permission_ids' => ['prohibited'],
            'email_verified_at' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'The email address is already registered.',
            'role_ids.required' => 'Select at least one role.',
            'role_ids.min' => 'Select at least one role.',
            'role_ids.*.exists' => 'One or more selected roles no longer exist.',
        ];
    }
}
