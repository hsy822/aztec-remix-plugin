import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';

interface Props {
  filters: {
    searchTerm: string;
    private: boolean;
    public: boolean;
    unconstrained: boolean;
  };
  onFilterChange: (key: string, value: any) => void;
}

export const FunctionFilter = ({ filters, onFilterChange }: Props) => {
  return (
    <Form.Group className="mt-3">
      <Form.Label>Filter Functions</Form.Label>
      <InputGroup className="mb-2">
        <Form.Control
          type="text"
          placeholder="Search function"
          value={filters.searchTerm}
          onChange={(e) => onFilterChange('searchTerm', e.target.value)}
        />
      </InputGroup>
      <div className="d-flex">
        <div className="custom-control custom-checkbox me-3">
          <input
            type="checkbox"
            className="custom-control-input"
            id="filterPrivate"
            checked={filters.private}
            onChange={(e) => onFilterChange('private', e.target.checked)}
          />
          <label className="custom-control-label" htmlFor="filterPrivate">Private</label>
        </div>
        <div className="custom-control custom-checkbox me-3">
          <input
            type="checkbox"
            className="custom-control-input"
            id="filterPublic"
            checked={filters.public}
            onChange={(e) => onFilterChange('public', e.target.checked)}
          />
          <label className="custom-control-label" htmlFor="filterPublic">Public</label>
        </div>
        <div className="custom-control custom-checkbox">
          <input
            type="checkbox"
            className="custom-control-input"
            id="filterUnconstrained"
            checked={filters.unconstrained}
            onChange={(e) => onFilterChange('unconstrained', e.target.checked)}
          />
          <label className="custom-control-label" htmlFor="filterUnconstrained">Unconstrained</label>
        </div>
      </div>
    </Form.Group>
  );
};
