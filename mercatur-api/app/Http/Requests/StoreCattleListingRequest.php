<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCattleListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('cattle.create') ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('title'))) {
            $this->merge(['title' => trim($this->input('title'))]);
        }
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'carcass_weight_kg' => ['required', 'numeric', 'gt:0', 'max:999999.999', 'decimal:0,3'],
            'price_per_kg' => ['required', 'numeric', 'gt:0', 'max:999999.99', 'decimal:0,2'],
            'farmer_id' => ['missing'],
            'status' => ['missing'],
            'published_at' => ['missing'],
            'total_value' => ['missing'],
        ];
    }

    public function attributes(): array
    {
        return [
            'carcass_weight_kg' => 'carcass weight',
            'price_per_kg' => 'price per kg',
        ];
    }

    public function messages(): array
    {
        return [
            'carcass_weight_kg.gt' => 'Carcass weight must be greater than 0 kg.',
            'carcass_weight_kg.decimal' => 'Carcass weight may have at most three decimal places.',
            'price_per_kg.gt' => 'Price per kg must be greater than R0.',
            'price_per_kg.decimal' => 'Price per kg may have at most two decimal places.',
            'farmer_id.missing' => 'The listing owner is determined by your signed-in account.',
            'status.missing' => 'New cattle listings are created as drafts.',
            'published_at.missing' => 'A new draft cannot have a publication date.',
            'total_value.missing' => 'The listing value is calculated by the server.',
        ];
    }
}
