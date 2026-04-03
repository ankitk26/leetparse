#include <bits/stdc++.h>
using namespace std;
using ll = long long int;
using ull = unsigned long long int;

template <typename T>
void printValue(const T& value) {
	cout << value;
}

void printValue(const string& value) {
	cout << '"' << value << '"';
}

void printValue(bool value) {
	cout << (value ? "true" : "false");
}

template <typename T>
void printValue(const vector<T>& values) {
	cout << "[";
	for (size_t i = 0; i < values.size(); ++i) {
		if (i) {
			cout << ", ";
		}
		printValue(values[i]);
	}
	cout << "]";
}

struct TreeNode {
	int val;
	TreeNode* left;
	TreeNode* right;
	TreeNode() : val(0), left(nullptr), right(nullptr) {}
	TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
	TreeNode(int x, TreeNode* left, TreeNode* right) : val(x), left(left), right(right) {}
};

vector<string> splitTreeTokens(const string& data) {
	string token;
	vector<string> tokens;
	for (char ch : data) {
		if (ch == '[' || ch == ']' || ch == ' ') {
			continue;
		}
		if (ch == ',') {
			if (!token.empty()) {
				tokens.push_back(token);
				token.clear();
			}
			continue;
		}
		token.push_back(ch);
	}
	if (!token.empty()) {
		tokens.push_back(token);
	}
	return tokens;
}

TreeNode* buildTree(const string& data) {
	auto tokens = splitTreeTokens(data);
	if (tokens.empty() || tokens[0] == "null") {
		return nullptr;
	}

	TreeNode* root = new TreeNode(stoi(tokens[0]));
	queue<TreeNode*> q;
	q.push(root);
	size_t index = 1;

	while (!q.empty() && index < tokens.size()) {
		TreeNode* node = q.front();
		q.pop();

		if (index < tokens.size() && tokens[index] != "null") {
			node->left = new TreeNode(stoi(tokens[index]));
			q.push(node->left);
		}
		++index;

		if (index < tokens.size() && tokens[index] != "null") {
			node->right = new TreeNode(stoi(tokens[index]));
			q.push(node->right);
		}
		++index;
	}

	return root;
}

void freeTree(TreeNode* root) {
	if (!root) {
		return;
	}
	freeTree(root->left);
	freeTree(root->right);
	delete root;
}


/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */
class Solution {
public:
    vector<vector<int>> levelOrderBottom(TreeNode* root) {
        
    }
};

int main() {
	TreeNode* root = buildTree("[3,9,20,null,null,15,7]");

	Solution *sol = new Solution();
	vector<vector<int>> result = sol->levelOrderBottom(root);

	printValue(result);
	cout << "\n";

	freeTree(root);
	delete sol;
	return 0;
}
